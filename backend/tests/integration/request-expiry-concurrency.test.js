'use strict';

/**
 * tests/integration/request-expiry-concurrency.test.js
 *
 * Module 08 — Test Groups H, I, J.
 *   H — a failure after one attempted restoration rolls the whole expiry back
 *   I — running expiry twice restores inventory exactly once
 *   J — two expiry attempts on the same request → exactly one effective expiry
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-expiry-conc-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createBank, rand } = require('../helpers/orgs');
const { processBatch } = require('../../src/modules/cleanup/request-expiry.service');
const { createExpiryTransaction } = require('../../src/modules/cleanup/request-expiry.transaction');

getDb();
test.after(() => closeDatabase());

function expiredRequest(db, hospitalId) {
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 3, 0, 'CRITICAL', 'OPEN', ?)
  `).run(`cr-${rand()}`, hospitalId, new Date(Date.now() - 5000).toISOString());
  return Number(info.lastInsertRowid);
}

function reserve(db, requestId, bankId, units) {
  const inv = db.prepare("SELECT * FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bankId);
  db.prepare('UPDATE inventory SET units_available = units_available - ? WHERE id = ?').run(units, inv.id);
  db.prepare(`INSERT INTO request_allocations (request_id, bank_id, units_reserved, status) VALUES (?,?,?,'RESERVED')`)
    .run(requestId, bankId, units);
}

test('H: a mid-transaction failure rolls the entire expiry back (no partial restoration)', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  db.prepare("UPDATE inventory SET units_available = 4 WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").run(bank.id);
  const reqId = expiredRequest(db, hospital.id);
  reserve(db, reqId, bank.id, 3);

  // Force a failure the moment the expiry restoration adjustment is written.
  db.exec(`
    CREATE TEMP TRIGGER trg_expiry_boom AFTER INSERT ON inventory_adjustments
    WHEN NEW.reason LIKE 'REQUEST_EXPIRY_RELEASE%'
    BEGIN SELECT RAISE(ABORT, 'boom'); END;
  `);

  try {
    assert.throws(() => processBatchThrowing(db));
  } finally {
    db.exec('DROP TRIGGER trg_expiry_boom;');
  }

  const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
  assert.equal(req.status, 'OPEN'); // rolled back
  assert.equal(req.closed_at, null);
  const inv = db.prepare("SELECT units_available FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);
  assert.equal(inv.units_available, 1); // 4 - 3, NOT restored
  const alloc = db.prepare('SELECT status FROM request_allocations WHERE request_id = ?').get(reqId);
  assert.equal(alloc.status, 'RESERVED');

  // processBatch itself swallows the per-request error; use the transaction directly to observe the throw.
  function processBatchThrowing(conn) {
    const { expireRequest } = createExpiryTransaction(conn);
    return expireRequest({ requestId: reqId, nowIso: new Date().toISOString() });
  }
});

test('I: running expiry twice does not double-restore inventory', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  db.prepare("UPDATE inventory SET units_available = 6 WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").run(bank.id);
  const reqId = expiredRequest(db, hospital.id);
  reserve(db, reqId, bank.id, 2);

  const now = new Date().toISOString();
  processBatch({ db, nowIso: now });
  processBatch({ db, nowIso: now });

  const inv = db.prepare("SELECT units_available FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);
  assert.equal(inv.units_available, 6); // restored once (4 -> 6), not 8
  assert.equal(db.prepare('SELECT status FROM requests WHERE id = ?').get(reqId).status, 'EXPIRED');

  const adjustments = db.prepare(
    "SELECT COUNT(*) AS n FROM inventory_adjustments WHERE reason LIKE ?"
  ).get(`REQUEST_EXPIRY_RELEASE:req=${reqId}`).n;
  assert.equal(adjustments, 1);
});

test('J: two direct expiry attempts on one request yield exactly one effective expiry', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { bank } = await createBank();
  db.prepare("UPDATE inventory SET units_available = 10 WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").run(bank.id);
  const reqId = expiredRequest(db, hospital.id);
  reserve(db, reqId, bank.id, 4);

  const { expireRequest } = createExpiryTransaction(db);
  const now = new Date().toISOString();
  const a = expireRequest({ requestId: reqId, nowIso: now });
  const b = expireRequest({ requestId: reqId, nowIso: now });

  assert.ok(a && a.releasedAllocationCount === 1);
  assert.equal(b, null);
  const inv = db.prepare("SELECT units_available FROM inventory WHERE bank_id=? AND blood_group='O-' AND component='RED_CELLS'").get(bank.id);
  assert.equal(inv.units_available, 10);
});
