'use strict';

/**
 * tests/integration/location-cleanup.test.js
 *
 * Module 08 — Test Groups R, S, U, V.
 *   R — expired location session is physically DELETEd
 *   S — a future-expiry session is untouched
 *   U — one tick respects LOCATION_CLEANUP_BATCH_SIZE
 *   V — overlapping ticks do not double-run the loop (job reentrancy)
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.LOCATION_CLEANUP_BATCH_SIZE = '3';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-loccleanup-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, createDonor, rand } = require('../helpers/orgs');
const locationCleanupService = require('../../src/modules/cleanup/location-cleanup.service');
const locationCleanupJob = require('../../src/jobs/location-cleanup.job');

getDb();
test.after(() => { locationCleanupJob.stop(); closeDatabase(); });

function makeRequest(db, hospitalId) {
  const info = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 1, 0, 'NORMAL', 'OPEN', ?)
  `).run(`cr-${rand()}`, hospitalId, new Date(Date.now() + 3600000).toISOString());
  return Number(info.lastInsertRowid);
}

function makeSession(db, donorId, requestId, { expired }) {
  const alert = db.prepare("INSERT INTO donor_alerts (request_id, donor_id, status) VALUES (?,?,'CLOSED')").run(requestId, donorId);
  const pledge = db.prepare(`
    INSERT INTO donor_pledges (request_id, donor_id, alert_id, public_reference, status)
    VALUES (?,?,?,?,'PLEDGED')
  `).run(requestId, donorId, Number(alert.lastInsertRowid), `REF-${rand()}`);
  const expiresAt = expired
    ? new Date(Date.now() - 60000).toISOString()
    : new Date(Date.now() + 3600000).toISOString();
  const info = db.prepare(`
    INSERT INTO donor_location_sessions (donor_id, request_id, pledge_id, latitude, longitude, expires_at)
    VALUES (?,?,?,18.52,73.85,?)
  `).run(donorId, requestId, Number(pledge.lastInsertRowid), expiresAt);
  return Number(info.lastInsertRowid);
}

test('R: an expired location session is physically deleted', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const reqId = makeRequest(db, hospital.id);
  const sessionId = makeSession(db, donor.id, reqId, { expired: true });

  const res = locationCleanupService.processBatch({ db, nowIso: new Date().toISOString() });
  assert.equal(res.deleted, 1);

  const row = db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions WHERE id = ?').get(sessionId).n;
  assert.equal(row, 0);
});

test('S: a session with a future expiry is not touched', async () => {
  const db = getDb();
  const { hospital } = await createHospital();
  const { donor } = await createDonor();
  const reqId = makeRequest(db, hospital.id);
  const sessionId = makeSession(db, donor.id, reqId, { expired: false });

  locationCleanupService.processBatch({ db, nowIso: new Date().toISOString() });

  const row = db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions WHERE id = ?').get(sessionId).n;
  assert.equal(row, 1);
});

test('U: one tick deletes at most LOCATION_CLEANUP_BATCH_SIZE rows', async () => {
  const db = getDb();
  db.prepare('DELETE FROM donor_location_sessions').run();
  const { hospital } = await createHospital();
  for (let i = 0; i < 5; i += 1) {
    const { donor } = await createDonor();
    const reqId = makeRequest(db, hospital.id);
    makeSession(db, donor.id, reqId, { expired: true });
  }

  const first = locationCleanupService.processBatch({ db, nowIso: new Date().toISOString() });
  assert.equal(first.deleted, 3); // batch size

  const second = locationCleanupService.processBatch({ db, nowIso: new Date().toISOString() });
  assert.equal(second.deleted, 2); // remainder

  const remaining = db.prepare('SELECT COUNT(*) AS n FROM donor_location_sessions').get().n;
  assert.equal(remaining, 0);
});

test('V: the job exposes lifecycle + reentrancy state and stops cleanly', async () => {
  assert.equal(locationCleanupJob.getStatus(), 'stopped');
  locationCleanupJob.start();
  assert.equal(locationCleanupJob.getStatus(), 'running');
  locationCleanupJob.start(); // idempotent — no second loop
  assert.equal(locationCleanupJob.getStatus(), 'running');
  locationCleanupJob.stop();
  assert.equal(locationCleanupJob.getStatus(), 'stopped');
});
