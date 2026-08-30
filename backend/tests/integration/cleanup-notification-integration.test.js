'use strict';

/**
 * tests/integration/cleanup-notification-integration.test.js
 *
 * Module 08 — Test Groups P, Q + "provider runs after commit".
 *   P — hospital + broadcast banks receive a QUEUED REQUEST_EXPIRED notification
 *   Q — a repeated expiry sweep does not duplicate the logical notification
 *   after-commit — the notification worker (provider) delivers it post-transaction
 *   audit — a REQUEST_EXPIRED audit row is written by the expiry transaction
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-cleanup-notif-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createBank, rand } = require('../helpers/orgs');
const { processBatch } = require('../../src/modules/cleanup/request-expiry.service');
const notificationWorker = require('../../src/modules/notifications/notification-worker.service');

getDb();
test.after(() => closeDatabase());

function expiredRequestWithBroadcast(db, hospitalId, bankId) {
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', 'OPEN', ?)
  `).run(`cr-${rand()}`, hospitalId, new Date(Date.now() - 5000).toISOString());
  const reqId = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO request_broadcasts (request_id, bank_id) VALUES (?, ?)').run(reqId, bankId);
  return reqId;
}

test('P: hospital and broadcast bank both receive a QUEUED REQUEST_EXPIRED notification', async () => {
  const db = getDb();
  const { hospital, user: hospitalUser } = await createHospital();
  const { bank, user: bankUser } = await createBank();
  const reqId = expiredRequestWithBroadcast(db, hospital.id, bank.id);

  processBatch({ db, nowIso: new Date().toISOString() });

  const hn = db.prepare("SELECT * FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'").get(hospitalUser.id);
  const bn = db.prepare("SELECT * FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'").get(bankUser.id);
  assert.ok(hn, 'hospital notified');
  assert.ok(bn, 'bank notified');
  assert.equal(hn.status, 'QUEUED');
  assert.equal(bn.status, 'QUEUED');

  const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'REQUEST_EXPIRED' AND entity_id = ?").get(reqId);
  assert.ok(audit, 'REQUEST_EXPIRED audit row written');
  assert.equal(audit.actor_user_id, null); // system action
  const meta = JSON.parse(audit.metadata_json);
  assert.equal(meta.previousStatus, 'OPEN');
});

test('after-commit: the worker delivers the queued expiry notification', async () => {
  const db = getDb();
  const { hospital, user: hospitalUser } = await createHospital();
  expiredRequestWithBroadcast(db, hospital.id, (await createBank()).bank.id);

  processBatch({ db, nowIso: new Date().toISOString() });
  const stats = notificationWorker.processBatch();
  assert.ok(stats.sent >= 1);

  const n = db.prepare("SELECT * FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'").get(hospitalUser.id);
  assert.equal(n.status, 'SENT');
  assert.equal(n.read_at, null); // delivery state is separate from read state
});

test('Q: a repeated expiry sweep does not duplicate the expiry notification', async () => {
  const db = getDb();
  const { hospital, user: hospitalUser } = await createHospital();
  const { bank } = await createBank();
  expiredRequestWithBroadcast(db, hospital.id, bank.id);

  const now = new Date().toISOString();
  processBatch({ db, nowIso: now });
  processBatch({ db, nowIso: now });
  processBatch({ db, nowIso: now });

  const count = db.prepare(
    "SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND event_type = 'REQUEST_EXPIRED'"
  ).get(hospitalUser.id).n;
  assert.equal(count, 1);
});
