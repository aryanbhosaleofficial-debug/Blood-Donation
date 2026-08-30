'use strict';

/**
 * tests/unit/request-expiry.test.js
 *
 * Module 08 — request-expiry transaction invariants that the integration
 * suite does not cover directly:
 *   - exact (not approximate) inventory restoration
 *   - INVENTORY_MAX_UNITS is a hard consistency bound, never silently clamped
 *   - the transaction is a no-op on an already-terminal request
 *   - created_at / expires_at are never mutated by expiry
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.INVENTORY_MAX_UNITS = process.env.INVENTORY_MAX_UNITS || '100';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-expiry-unit-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createBank, rand } = require('../helpers/orgs');
const { createExpiryTransaction } = require('../../src/modules/cleanup/request-expiry.transaction');
const {
  ACTIVE_REQUEST_STATUSES,
  TERMINAL_REQUEST_STATUSES,
  EXPIRY_RESTORATION_REASON,
} = require('../../src/modules/cleanup/cleanup.constants');

getDb();
test.after(() => closeDatabase());

function pastRequest(db, hospitalId, status = 'OPEN') {
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', ?, ?)
  `).run(`cr-${rand()}`, hospitalId, status, new Date(Date.now() - 5000).toISOString());
  return db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(info.lastInsertRowid));
}

function reserve(db, requestId, bankId, units) {
  const inv = db.prepare("SELECT * FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bankId);
  db.prepare('UPDATE inventory SET units_available = units_available - ?, version = version + 1 WHERE id = ?').run(units, inv.id);
  db.prepare(`INSERT INTO request_allocations (request_id, bank_id, units_reserved, status) VALUES (?,?,?,'RESERVED')`)
    .run(requestId, bankId, units);
}

test('constants: active vs terminal request statuses are disjoint and complete', () => {
  assert.deepEqual(ACTIVE_REQUEST_STATUSES, ['OPEN', 'COVERED']);
  assert.deepEqual(TERMINAL_REQUEST_STATUSES, ['COMPLETED', 'CANCELLED', 'EXPIRED']);
  const all = new Set([...ACTIVE_REQUEST_STATUSES, ...TERMINAL_REQUEST_STATUSES]);
  assert.equal(all.size, 5);
});

test('expiry restores exactly the reserved units and bumps inventory version by one', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  db.prepare("UPDATE inventory SET units_available = 9 WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").run(bank.id);

  const req = pastRequest(db, hospital.id);
  reserve(db, req.id, bank.id, 3);
  const invBefore = db.prepare("SELECT * FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);

  const { expireRequest } = createExpiryTransaction(db);
  const result = expireRequest({ requestId: req.id, nowIso: new Date().toISOString() });

  const invAfter = db.prepare("SELECT * FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);
  assert.equal(invAfter.units_available, invBefore.units_available + 3);
  assert.equal(invAfter.version, invBefore.version + 1);
  assert.equal(result.releasedAllocationCount, 1);

  const adj = db.prepare('SELECT * FROM inventory_adjustments WHERE inventory_id=? ORDER BY id DESC LIMIT 1').get(invBefore.id);
  assert.ok(adj.reason.startsWith(EXPIRY_RESTORATION_REASON));
  assert.equal(adj.actor_user_id, null);
  assert.equal(adj.previous_units, invBefore.units_available);
  assert.equal(adj.new_units, invBefore.units_available + 3);
});

test('expiry refuses to push inventory above INVENTORY_MAX_UNITS (controlled failure, no clamp)', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  // Contrive an inconsistent state: stock already near the max, plus a reservation.
  db.prepare("UPDATE inventory SET units_available = 99 WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").run(bank.id);
  const req = pastRequest(db, hospital.id);
  db.prepare(`INSERT INTO request_allocations (request_id, bank_id, units_reserved, status) VALUES (?,?,5,'RESERVED')`).run(req.id, bank.id);

  const { expireRequest } = createExpiryTransaction(db);
  assert.throws(() => expireRequest({ requestId: req.id, nowIso: new Date().toISOString() }), /INVENTORY_MAX_UNITS|limit/i);

  // Rolled back: request still active, stock untouched, allocation still RESERVED.
  const reqAfter = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.id);
  assert.equal(reqAfter.status, 'OPEN');
  const inv = db.prepare("SELECT units_available FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);
  assert.equal(inv.units_available, 99);
  const alloc = db.prepare('SELECT status FROM request_allocations WHERE request_id = ?').get(req.id);
  assert.equal(alloc.status, 'RESERVED');
});

test('expiry is a no-op on an already-terminal request and never mutates timestamps', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const created = new Date(Date.now() - 100000).toISOString();
  const expires = new Date(Date.now() - 5000).toISOString();
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, created_at, expires_at, closed_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 1, 0, 'NORMAL', 'CANCELLED', ?, ?, ?)
  `).run(`cr-${rand()}`, hospital.id, created, expires, created);
  const id = Number(info.lastInsertRowid);

  const { expireRequest } = createExpiryTransaction(db);
  const result = expireRequest({ requestId: id, nowIso: new Date().toISOString() });
  assert.equal(result, null);

  const after = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  assert.equal(after.status, 'CANCELLED');
  assert.equal(after.created_at, created);
  assert.equal(after.expires_at, expires);
});
