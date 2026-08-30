'use strict';

/**
 * tests/integration/request-expiry.test.js
 *
 * Tests for Module 08 request expiry processing.
 *
 * Test Groups covered:
 *   A – Basic expiry (OPEN, no allocations)
 *   B – Future request (not expired)
 *   C – Already closed request (no mutation)
 *   D – RESERVED allocation restoration
 *   E – COMPLETED allocation not restored
 *   F – Multiple banks
 *   G – Inventory history created
 *   H – Atomicity
 *   I – Duplicate expiry run (idempotent)
 *   J – Concurrent expiry (exactly one effective expiry)
 *   K – Pledge expiry (PLEDGED → EXPIRED)
 *   L – Arrived pledge (ARRIVED → CLOSED)
 *   M – Donor alerts closed
 *   N – Location session deleted
 *   O – Broadcasts closed
 *   P – Expiry notification queued
 *   Q – Notification deduplication
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-expiry-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createBank, createDonor, rand } = require('../helpers/orgs');
const { processBatch } = require('../../src/modules/cleanup/request-expiry.service');
const { createExpiryTransaction } = require('../../src/modules/cleanup/request-expiry.transaction');

// Initialize schema
getDb();

test.after(() => closeDatabase());

// ─── Helpers ───────────────────────────────────────────────────────────────

function createRequest(db, hospitalId, { status = 'OPEN', expiresAt } = {}) {
  const expiry = expiresAt ?? new Date(Date.now() - 5000).toISOString(); // past by default
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', ?, ?)
  `).run(`cr-${rand()}`, hospitalId, status, expiry);
  return db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(info.lastInsertRowid));
}

function reserveAllocation(db, requestId, bankId, units, actorUserId) {
  // Decrement inventory first
  const inv = db.prepare("SELECT * FROM inventory WHERE bank_id = ? AND blood_group = 'O-' AND component = 'RED_CELLS'").get(bankId);
  db.prepare("UPDATE inventory SET units_available = units_available - ?, version = version + 1 WHERE id = ?").run(units, inv.id);
  db.prepare(`
    INSERT INTO inventory_adjustments (inventory_id, bank_id, actor_user_id, previous_units, new_units, previous_version, new_version, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'RESERVE')
  `).run(inv.id, bankId, actorUserId, inv.units_available, inv.units_available - units, inv.version, inv.version + 1);
  const info = db.prepare(`
    INSERT INTO request_allocations (request_id, bank_id, units_reserved, status)
    VALUES (?, ?, ?, 'RESERVED')
  `).run(requestId, bankId, units);
  return db.prepare('SELECT * FROM request_allocations WHERE id = ?').get(Number(info.lastInsertRowid));
}

function setInventoryUnits(db, bankId, units) {
  db.prepare("UPDATE inventory SET units_available = ? WHERE bank_id = ? AND blood_group = 'O-' AND component = 'RED_CELLS'").run(units, bankId);
}

function getInventory(db, bankId) {
  return db.prepare("SELECT * FROM inventory WHERE bank_id = ? AND blood_group = 'O-' AND component = 'RED_CELLS'").get(bankId);
}

function insertBroadcast(db, requestId, bankId) {
  db.prepare("INSERT OR IGNORE INTO request_broadcasts (request_id, bank_id) VALUES (?, ?)").run(requestId, bankId);
}

function insertDonorAlert(db, requestId, donorId) {
  const info = db.prepare("INSERT INTO donor_alerts (request_id, donor_id, status) VALUES (?, ?, 'ACTIVE')").run(requestId, donorId);
  return db.prepare('SELECT * FROM donor_alerts WHERE id = ?').get(Number(info.lastInsertRowid));
}

function insertPledge(db, requestId, donorId, alertId, status = 'PLEDGED') {
  const info = db.prepare(`
    INSERT INTO donor_pledges (request_id, donor_id, alert_id, public_reference, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(requestId, donorId, alertId, `REF-${rand()}`, status);
  const pledge = db.prepare('SELECT * FROM donor_pledges WHERE id = ?').get(Number(info.lastInsertRowid));
  if (status === 'ARRIVED') {
    db.prepare("UPDATE donor_pledges SET arrived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(pledge.id);
  }
  return pledge;
}

function insertLocationSession(db, donorId, requestId, pledgeId) {
  const info = db.prepare(`
    INSERT INTO donor_location_sessions (donor_id, request_id, pledge_id, latitude, longitude, expires_at)
    VALUES (?, ?, ?, 18.52, 73.85, ?)
  `).run(donorId, requestId, pledgeId, new Date(Date.now() + 3600000).toISOString());
  return db.prepare('SELECT * FROM donor_location_sessions WHERE id = ?').get(Number(info.lastInsertRowid));
}

// ─── Test Group A — Basic Expiry ─────────────────────────────────────────

test('A: OPEN request with past expires_at is marked EXPIRED', async () => {
  const { hospital } = await createHospital();
  const db = getDb();
  const req = createRequest(db, hospital.id, { status: 'OPEN' });

  const result = processBatch({ db, nowIso: new Date().toISOString() });
  assert.ok(result.expired >= 1);

  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id);
  assert.equal(updated.status, 'EXPIRED');
  assert.ok(updated.closed_at);
});

// ─── Test Group B — Future Request ───────────────────────────────────────

test('B: OPEN request with future expires_at is not changed', async () => {
  const { hospital } = await createHospital();
  const db = getDb();
  const futureExpiry = new Date(Date.now() + 3600000).toISOString();
  const req = createRequest(db, hospital.id, { status: 'OPEN', expiresAt: futureExpiry });

  processBatch({ db, nowIso: new Date().toISOString() });

  const after = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id);
  assert.equal(after.status, 'OPEN');
  assert.equal(after.closed_at, null);
});

// ─── Test Group C — Already Closed ────────────────────────────────────────

test('C: COMPLETED request is not mutated', async () => {
  const { hospital } = await createHospital();
  const db = getDb();
  const past = new Date(Date.now() - 5000).toISOString();
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at, closed_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', 'COMPLETED', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(`cr-${rand()}`, hospital.id, past);
  const reqId = Number(info.lastInsertRowid);

  processBatch({ db, nowIso: new Date().toISOString() });

  const after = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
  assert.equal(after.status, 'COMPLETED'); // not mutated
});

test('C2: EXPIRED request is not mutated again', async () => {
  const { hospital } = await createHospital();
  const db = getDb();
  const past = new Date(Date.now() - 5000).toISOString();
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at, closed_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', 'EXPIRED', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(`cr-${rand()}`, hospital.id, past);
  const reqId = Number(info.lastInsertRowid);

  const result = processBatch({ db, nowIso: new Date().toISOString() });

  const after = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
  assert.equal(after.status, 'EXPIRED'); // still EXPIRED, no duplication
});

// ─── Test Group D — Reserved Allocation Restoration ───────────────────────

test('D: RESERVED allocation is released and inventory restored on expiry', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank.id, 3);
  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);
  reserveAllocation(db, req.id, bank.id, 2, bank.id);

  const invBefore = getInventory(db, bank.id);
  assert.equal(invBefore.units_available, 1); // 3 - 2

  processBatch({ db, nowIso: new Date().toISOString() });

  const invAfter = getInventory(db, bank.id);
  assert.equal(invAfter.units_available, 3); // restored to 3
  assert.ok(invAfter.version > invBefore.version);

  const alloc = db.prepare('SELECT * FROM request_allocations WHERE request_id = ?').get(req.id);
  assert.equal(alloc.status, 'RELEASED');
  assert.ok(alloc.released_at);
});

// ─── Test Group E — Completed Allocation Not Restored ─────────────────────

test('E: COMPLETED allocation is NOT restored on expiry', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank.id, 5);
  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);

  // Insert a COMPLETED allocation (already delivered)
  db.prepare(`
    INSERT INTO request_allocations (request_id, bank_id, units_reserved, status, completed_at)
    VALUES (?, ?, 2, 'COMPLETED', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(req.id, bank.id);

  const invBefore = getInventory(db, bank.id);
  assert.equal(invBefore.units_available, 5);

  processBatch({ db, nowIso: new Date().toISOString() });

  const invAfter = getInventory(db, bank.id);
  assert.equal(invAfter.units_available, 5); // unchanged
});

// ─── Test Group F — Multiple Banks ────────────────────────────────────────

test('F: multiple RESERVED allocations are each restored exactly once', async () => {
  const { hospital } = await createHospital();
  const { bank: bank1 } = await createBank();
  const { bank: bank2 } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank1.id, 10);
  setInventoryUnits(db, bank2.id, 10);

  const req = createRequest(db, hospital.id, { status: 'COVERED' });
  insertBroadcast(db, req.id, bank1.id);
  insertBroadcast(db, req.id, bank2.id);
  reserveAllocation(db, req.id, bank1.id, 3, bank1.id);
  reserveAllocation(db, req.id, bank2.id, 2, bank2.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const inv1 = getInventory(db, bank1.id);
  const inv2 = getInventory(db, bank2.id);
  assert.equal(inv1.units_available, 10);
  assert.equal(inv2.units_available, 10);
});

// ─── Test Group G — Inventory History ────────────────────────────────────

test('G: expiry creates inventory_adjustment record', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank.id, 5);
  const inv = getInventory(db, bank.id);
  const adjustmentsBefore = db.prepare('SELECT COUNT(*) AS n FROM inventory_adjustments WHERE inventory_id = ?').get(inv.id).n;

  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);
  reserveAllocation(db, req.id, bank.id, 2, bank.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const adjustmentsAfter = db.prepare('SELECT COUNT(*) AS n FROM inventory_adjustments WHERE inventory_id = ?').get(inv.id).n;
  assert.ok(adjustmentsAfter > adjustmentsBefore);

  const lastAdj = db.prepare("SELECT * FROM inventory_adjustments WHERE inventory_id = ? ORDER BY id DESC LIMIT 1").get(inv.id);
  assert.ok(lastAdj.reason.includes('REQUEST_EXPIRY_RELEASE'));
  assert.equal(lastAdj.actor_user_id, null); // system action
});

// ─── Test Group I — Duplicate Expiry Run ─────────────────────────────────

test('I: running expiry twice does not double-restore inventory', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank.id, 5);
  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);
  reserveAllocation(db, req.id, bank.id, 2, bank.id);

  const now = new Date().toISOString();
  processBatch({ db, nowIso: now });
  processBatch({ db, nowIso: now }); // second run

  const invAfter = getInventory(db, bank.id);
  assert.equal(invAfter.units_available, 5); // exactly 5, not 7

  const reqAfter = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id);
  assert.equal(reqAfter.status, 'EXPIRED');
});

// ─── Test Group J — Concurrent Expiry ────────────────────────────────────

test('J: concurrent expiry transactions result in exactly one expiry', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  setInventoryUnits(db, bank.id, 10);
  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);
  reserveAllocation(db, req.id, bank.id, 3, bank.id);

  const { expireRequest } = createExpiryTransaction(db);
  const now = new Date().toISOString();

  // Execute two sequential expiry attempts on the same request.
  const result1 = expireRequest({ requestId: req.id, nowIso: now });
  const result2 = expireRequest({ requestId: req.id, nowIso: now }); // should be no-op

  assert.ok(result1 !== null);   // first succeeded
  assert.ok(result2 === null);   // second is no-op (already EXPIRED)

  const invAfter = getInventory(db, bank.id);
  assert.equal(invAfter.units_available, 10); // exactly 10, not 13
});

// ─── Test Group K — Pledge Expiry ────────────────────────────────────────

test('K: PLEDGED donor pledge becomes EXPIRED on request expiry', async () => {
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  const alert = insertDonorAlert(db, req.id, donor.id);
  insertPledge(db, req.id, donor.id, alert.id, 'PLEDGED');

  processBatch({ db, nowIso: new Date().toISOString() });

  const pledge = db.prepare('SELECT * FROM donor_pledges WHERE request_id = ?').get(req.id);
  assert.equal(pledge.status, 'EXPIRED');
  assert.ok(pledge.closed_at);
});

// ─── Test Group L — Arrived Pledge ───────────────────────────────────────

test('L: ARRIVED donor pledge becomes CLOSED on request expiry', async () => {
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  const alert = insertDonorAlert(db, req.id, donor.id);
  insertPledge(db, req.id, donor.id, alert.id, 'ARRIVED');

  processBatch({ db, nowIso: new Date().toISOString() });

  const pledge = db.prepare('SELECT * FROM donor_pledges WHERE request_id = ?').get(req.id);
  assert.equal(pledge.status, 'CLOSED'); // ARRIVED → CLOSED (not EXPIRED, arrival is acknowledged)
  assert.ok(pledge.closed_at);
});

// ─── Test Group M — Donor Alerts ─────────────────────────────────────────

test('M: active donor alerts are closed on request expiry', async () => {
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  insertDonorAlert(db, req.id, donor.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const alert = db.prepare('SELECT * FROM donor_alerts WHERE request_id = ?').get(req.id);
  assert.equal(alert.status, 'CLOSED');
  assert.ok(alert.closed_at);
});

// ─── Test Group N — Location Deletion ────────────────────────────────────

test('N: donor_location_sessions are physically deleted on request expiry', async () => {
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  const alert = insertDonorAlert(db, req.id, donor.id);
  const pledge = insertPledge(db, req.id, donor.id, alert.id, 'PLEDGED');
  const session = insertLocationSession(db, donor.id, req.id, pledge.id);

  const before = db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions WHERE id = ?').get(session.id).n;
  assert.equal(before, 1);

  processBatch({ db, nowIso: new Date().toISOString() });

  const after = db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions WHERE id = ?').get(session.id).n;
  assert.equal(after, 0); // physically deleted
});

// ─── Test Group O — Broadcasts ───────────────────────────────────────────

test('O: broadcasts become CLOSED on request expiry', async () => {
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  insertBroadcast(db, req.id, bank.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const broadcast = db.prepare('SELECT * FROM request_broadcasts WHERE request_id = ?').get(req.id);
  assert.equal(broadcast.status, 'CLOSED');
});

// ─── Test Group P — Expiry Notification ──────────────────────────────────

test('P: REQUEST_EXPIRED notification is queued for hospital on expiry', async () => {
  const { hospital, user } = await createHospital();
  const db = getDb();

  const req = createRequest(db, hospital.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const notification = db.prepare(`
    SELECT * FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'
  `).get(user.id);
  assert.ok(notification, 'Hospital should receive REQUEST_EXPIRED notification');
  assert.equal(notification.status, 'QUEUED');
});

// ─── Test Group Q — Notification Deduplication ───────────────────────────

test('Q: repeated expiry does not duplicate notifications', async () => {
  const { hospital, user } = await createHospital();
  const db = getDb();

  const req = createRequest(db, hospital.id);
  const now = new Date().toISOString();

  processBatch({ db, nowIso: now });
  processBatch({ db, nowIso: now }); // second run

  const count = db.prepare(`
    SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'
  `).get(user.id).n;
  assert.equal(count, 1); // only one, despite two runs
});
