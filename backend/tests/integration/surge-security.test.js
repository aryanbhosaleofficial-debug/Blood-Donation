'use strict';

/**
 * tests/integration/surge-security.test.js
 *
 * Module 09 — Test Groups U (CSRF), V (Origin) + access-control invariants.
 *   - no public surge API
 *   - unauthenticated -> 401
 *   - non-ADMIN -> 403
 *   - confirm/reject without CSRF -> 403
 *   - confirm/reject with a bad Origin -> 403
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-sec-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'surge-sec.db');

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

async function seedCandidate() {
  const db = getDb();
  baselineService.ensureSyntheticBaseline(db);
  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  return db.prepare("SELECT id FROM surge_candidates ORDER BY id DESC LIMIT 1").get().id;
}

test('there is no public (non-admin) surge API', async () => {
  const anon = srv.client();
  assert.equal((await anon.get('/api/surge')).status, 404);
  assert.equal((await anon.get('/api/admin/surge/candidates')).status, 401);
});

test('U: confirm without a CSRF token -> 403', async () => {
  const id = await seedCandidate();
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  await loginAs(client, { email: user.email, password: user.password });
  const res = await client.post(`/api/admin/surge/candidates/${id}/confirm`, {}, { headers: { Origin: srv.origin } });
  assert.equal(res.status, 403);
});

test('V: confirm with a bad Origin -> 403', async () => {
  const id = await seedCandidate();
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  const res = await client.post(
    `/api/admin/surge/candidates/${id}/reject`, {},
    { headers: { 'X-CSRF-Token': csrf, Origin: 'https://evil.example.com' } },
  );
  assert.equal(res.status, 403);
});

test('non-ADMIN cannot confirm even with a valid CSRF token', async () => {
  const id = await seedCandidate();
  const client = srv.client();
  const user = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  const res = await client.post(
    `/api/admin/surge/candidates/${id}/confirm`, {},
    { headers: { 'X-CSRF-Token': csrf, Origin: srv.origin } },
  );
  assert.equal(res.status, 403);
  assert.equal(getDb().prepare('SELECT status FROM surge_candidates WHERE id = ?').get(id).status, 'PENDING');
});

test('candidate list rejects an unknown status filter (400) — no arbitrary SQL filters', async () => {
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  const res = await client.get('/api/admin/surge/candidates?status=DISASTER_CONFIRMED', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 400);
});
