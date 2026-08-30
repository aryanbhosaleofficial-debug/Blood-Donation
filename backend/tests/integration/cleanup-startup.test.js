'use strict';

/**
 * tests/integration/cleanup-startup.test.js
 *
 * Module 08 — Test Group T (startup sweep).
 * Simulates the process being offline while state expired: a stale request and
 * a stale location session already exist before the sweep runs. The one-shot
 * startup sweep must clean both.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-startup-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createDonor, rand } = require('../helpers/orgs');
const cleanupService = require('../../src/modules/cleanup/cleanup.service');

getDb();
test.after(() => closeDatabase());

test('T: startup sweep expires a stale request and deletes a stale location session', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { donor } = await createDonor();

  // Stale OPEN request (expired 10 minutes ago).
  const reqInfo = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 1, 0, 'NORMAL', 'OPEN', ?)
  `).run(`cr-${rand()}`, hospital.id, new Date(Date.now() - 600000).toISOString());
  const reqId = Number(reqInfo.lastInsertRowid);

  // Stale location session on a second request.
  const req2 = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 1, 0, 'NORMAL', 'OPEN', ?)
  `).run(`cr-${rand()}`, hospital.id, new Date(Date.now() + 3600000).toISOString());
  const req2Id = Number(req2.lastInsertRowid);
  const alert = db.prepare("INSERT INTO donor_alerts (request_id, donor_id, status) VALUES (?,?,'CLOSED')").run(req2Id, donor.id);
  const pledge = db.prepare(`
    INSERT INTO donor_pledges (request_id, donor_id, alert_id, public_reference, status)
    VALUES (?,?,?,?,'PLEDGED')
  `).run(req2Id, donor.id, Number(alert.lastInsertRowid), `REF-${rand()}`);
  const sess = db.prepare(`
    INSERT INTO donor_location_sessions (donor_id, request_id, pledge_id, latitude, longitude, expires_at)
    VALUES (?,?,?,18.5,73.8,?)
  `).run(donor.id, req2Id, Number(pledge.lastInsertRowid), new Date(Date.now() - 60000).toISOString());
  const sessId = Number(sess.lastInsertRowid);

  cleanupService.runStartupSweeps();

  assert.equal(db.prepare('SELECT status FROM requests WHERE id = ?').get(reqId).status, 'EXPIRED');
  assert.ok(db.prepare('SELECT closed_at FROM requests WHERE id = ?').get(reqId).closed_at);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions WHERE id = ?').get(sessId).n, 0);
});

test('T2: startup sweep is safe to run twice (idempotent, no throw)', () => {
  assert.doesNotThrow(() => {
    cleanupService.runStartupSweeps();
    cleanupService.runStartupSweeps();
  });
});
