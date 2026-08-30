'use strict';

/**
 * tests/integration/surge-admin.test.js
 *
 * Module 09 — Test Groups P, Q, R, S, T + metrics integration.
 *   P listing (ADMIN only), Q detail, R confirm -> one event,
 *   S reject -> no event, T invalid-state 409, + Module 08 metrics counts.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-admin-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'surge-admin.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createTestUser } = require('../helpers/users');
const { startTestServer, loginAs } = require('../helpers/server');
const { createCityHospitals, insertRequests } = require('../helpers/surge');
const baselineService = require('../../src/modules/surge/baseline.service');
const detector = require('../../src/modules/surge/surge-detector.service');

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.close(); closeDatabase(); });

async function admin() {
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  return { client, csrf, user, w: { headers: { 'X-CSRF-Token': csrf, Origin: srv.origin } } };
}

async function seedCandidate(city = 'Ahmedabad') {
  const db = getDb();
  baselineService.ensureSyntheticBaseline(db);
  if (city !== 'Ahmedabad') {
    for (let h = 0; h < 24; h += 1) {
      require('../../src/modules/surge/baseline.repository').upsert(db, {
        city, bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
      });
    }
  }
  const hospitals = await createCityHospitals(3, { city });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  return db.prepare("SELECT * FROM surge_candidates WHERE city = ? ORDER BY id DESC LIMIT 1").get(city);
}

test('P: ADMIN lists candidates (PENDING first); other roles get 403', async () => {
  await seedCandidate('Ahmedabad');
  const { client, w } = await admin();
  const res = await client.get('/api/admin/surge/candidates', w);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.data.candidates));
  assert.ok(res.json.data.candidates.length >= 1);
  assert.equal(res.json.data.candidates[0].status, 'PENDING');

  for (const role of ['HOSPITAL', 'BLOOD_BANK', 'DONOR']) {
    const c = srv.client();
    const u = await createTestUser({ role, isActive: 1, isVerified: 1 });
    const csrf = await loginAs(c, { email: u.email, password: u.password });
    const r = await c.get('/api/admin/surge/candidates', { headers: { 'X-CSRF-Token': csrf, Origin: srv.origin } });
    assert.equal(r.status, 403, `${role} must be forbidden`);
  }
});

test('Q: ADMIN reads candidate detail evidence (no private data)', async () => {
  const cand = await seedCandidate('Rajkot');
  const { client, w } = await admin();
  const res = await client.get(`/api/admin/surge/candidates/${cand.id}`, w);
  assert.equal(res.status, 200);
  const c = res.json.data.candidate;
  assert.equal(c.observedRequests, 8);
  assert.ok(c.poissonTailProbability < 0.01);
  assert.equal(c.baselineSource, 'SYNTHETIC');
  const blob = JSON.stringify(res.json.data).toLowerCase();
  for (const bad of ['phone', 'latitude', 'longitude', 'password', 'request_note', 'patient']) {
    assert.ok(!blob.includes(bad), `must not expose ${bad}`);
  }
});

test('R: confirm PENDING -> CONFIRMED and creates exactly one ACTIVE surge_event', async () => {
  const cand = await seedCandidate('Surat');
  const { client, w } = await admin();
  const res = await client.post(`/api/admin/surge/candidates/${cand.id}/confirm`, { note: 'monitoring only' }, w);
  assert.equal(res.status, 200);
  assert.equal(res.json.data.candidate.status, 'CONFIRMED');
  assert.equal(res.json.data.event.status, 'ACTIVE');

  const events = getDb().prepare('SELECT * FROM surge_events WHERE candidate_id = ?').all(cand.id);
  assert.equal(events.length, 1);

  const list = await client.get('/api/admin/surge/events', w);
  assert.equal(list.status, 200);
  assert.ok(list.json.data.events.some((e) => e.candidateId === cand.id));
});

test('S: reject PENDING -> REJECTED and creates no surge_event', async () => {
  const cand = await seedCandidate('Bhavnagar');
  const { client, w } = await admin();
  const res = await client.post(`/api/admin/surge/candidates/${cand.id}/reject`, { note: 'known test exercise' }, w);
  assert.equal(res.status, 200);
  assert.equal(res.json.data.candidate.status, 'REJECTED');
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM surge_events WHERE candidate_id = ?').get(cand.id).n, 0);
});

test('T: confirming / rejecting an already-reviewed candidate returns 409 INVALID_SURGE_STATE', async () => {
  const cand = await seedCandidate('Anand');
  const { client, w } = await admin();
  await client.post(`/api/admin/surge/candidates/${cand.id}/confirm`, {}, w);

  const reConfirm = await client.post(`/api/admin/surge/candidates/${cand.id}/confirm`, {}, w);
  const reReject = await client.post(`/api/admin/surge/candidates/${cand.id}/reject`, {}, w);
  assert.equal(reConfirm.status, 409);
  assert.equal(reConfirm.json.error.code, 'INVALID_SURGE_STATE');
  assert.equal(reReject.status, 409);
});

test('metrics: Module 08 /api/admin/metrics includes surge aggregate counts', async () => {
  await seedCandidate('Mehsana');
  const { client, w } = await admin();
  const res = await client.get('/api/admin/metrics', w);
  assert.equal(res.status, 200);
  const surge = res.json.data.metrics.surge;
  assert.ok(surge);
  assert.equal(typeof surge.pendingCandidates, 'number');
  assert.equal(typeof surge.confirmedCandidates, 'number');
  assert.equal(typeof surge.rejectedCandidates, 'number');
  assert.equal(typeof surge.activeSurgeEvents, 'number');
  assert.ok(surge.pendingCandidates >= 1);
  assert.equal(res.json.data.metrics.workers.surgeDetector, 'stopped');
});
