'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { createHospital, setVerified, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

before(async () => {
  srv = await startTestServer();
});
after(async () => {
  await srv.close();
  closeDatabase();
});

test('A: a verified hospital creates an OPEN, non-synthetic, expiring request it owns', async () => {
  const { user, hospital } = await createHospital({ email: 'a-create@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);

  const res = await c.post('/api/requests', requestPayload(), write(token));
  assert.equal(res.status, 201);

  const r = res.json.data.request;
  assert.equal(r.status, 'OPEN');
  assert.equal(r.component, 'RED_CELLS');
  assert.equal(r.hospitalId, hospital.id);
  assert.equal(r.isSynthetic, false);
  assert.ok(r.createdAt && r.expiresAt);
  assert.ok(new Date(r.expiresAt).getTime() > new Date(r.createdAt).getTime());
  assert.equal(res.json.data.idempotentReplay, false);

  const dbRow = getDb().prepare('SELECT * FROM requests WHERE id = ?').get(r.id);
  assert.equal(dbRow.hospital_id, hospital.id);
  assert.equal(dbRow.is_synthetic, 0);
  assert.equal(dbRow.status, 'OPEN');
});

test('A: expiry equals created_at + REQUEST_TTL_MINUTES (120)', async () => {
  const { user } = await createHospital({ email: 'a-ttl@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const r = (await c.post('/api/requests', requestPayload(), write(token))).json.data.request;
  const deltaMinutes = (Date.parse(r.expiresAt) - Date.parse(r.createdAt)) / 60000;
  assert.ok(Math.abs(deltaMinutes - 120) < 1, `ttl was ${deltaMinutes} min`);
});

test('B: an unverified hospital cannot create a request', async () => {
  const { user } = await createHospital({ email: 'b-unverified@m3.test', verified: false });
  const c = srv.client();
  const token = await loginAs(c, user);
  const res = await c.post('/api/requests', requestPayload(), write(token));
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, 'ORGANIZATION_NOT_VERIFIED');
});

test('B: verification revoked mid-session blocks creation without re-login', async () => {
  const { user } = await createHospital({ email: 'b-revoke@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  assert.equal((await c.post('/api/requests', requestPayload(), write(token))).status, 201);

  setVerified(user.id, false); // admin revokes; same session/cookie kept
  const after = await c.post('/api/requests', requestPayload(), write(token));
  assert.equal(after.status, 403);
  assert.equal(after.json.error.code, 'ORGANIZATION_NOT_VERIFIED');
});

test('B: a verified hospital user with no profile row gets 409 HOSPITAL_PROFILE_REQUIRED', async () => {
  const user = await createTestUser({ email: 'b-noprofile@m3.test', role: 'HOSPITAL', isVerified: 1 });
  const c = srv.client();
  const token = await loginAs(c, user);
  const res = await c.post('/api/requests', requestPayload(), write(token));
  assert.equal(res.status, 409);
  assert.equal(res.json.error.code, 'HOSPITAL_PROFILE_REQUIRED');
});

test('C: non-hospital roles and anonymous callers cannot create requests', async () => {
  const bankUser = await createTestUser({ email: 'c-bank@m3.test', role: 'BLOOD_BANK', isVerified: 1 });
  const donor = await createTestUser({ email: 'c-donor@m3.test', role: 'DONOR', isVerified: 1 });
  const admin = await createTestUser({ email: 'c-admin@m3.test', role: 'ADMIN' });

  for (const u of [bankUser, donor, admin]) {
    const c = srv.client();
    const token = await loginAs(c, u);
    const res = await c.post('/api/requests', requestPayload(), write(token));
    assert.equal(res.status, 403, `${u.role} should be forbidden`);
  }

  // Anonymous GET is a clean 401; anonymous POST is rejected by the CSRF layer
  // (no session token) before it can reach the role check.
  assert.equal((await srv.client().get('/api/requests')).status, 401);
  const anonPost = await srv.client().post('/api/requests', requestPayload(), { headers: { Origin: ORIGIN } });
  assert.equal(anonPost.status, 403);
});

test('S: protected fields cannot make a hospital request synthetic', async () => {
  const { user } = await createHospital({ email: 's-synthetic@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);

  const res = await c.post(
    '/api/requests',
    { ...requestPayload(), isSynthetic: true, scenarioId: 'FAKE_DEMO' },
    write(token),
  );
  // strict schema: unexpected fields are a 400
  assert.equal(res.status, 400);
  assert.equal(res.json.error.code, 'VALIDATION_ERROR');
});

test('T: the create response exposes no account/security fields', async () => {
  const { user } = await createHospital({ email: 't-privacy@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const res = await c.post('/api/requests', requestPayload({ note: 'sensitive-ish text' }), write(token));
  const body = res.text.toLowerCase();
  for (const leak of ['password', 'password_hash', 'csrf', 'session', 'failed_login', 'license_no', 'contact_phone']) {
    assert.equal(body.includes(leak), false, leak);
  }
});

test('note above 500 characters is rejected (not silently truncated)', async () => {
  const { user } = await createHospital({ email: 'note-long@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const res = await c.post('/api/requests', requestPayload({ note: 'x'.repeat(600) }), write(token));
  assert.equal(res.status, 400);
});

test('a fresh clientRequestId per hospital always yields a new request', async () => {
  const { user } = await createHospital({ email: 'fresh-uuid@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const first = await c.post('/api/requests', requestPayload({ clientRequestId: crypto.randomUUID() }), write(token));
  const second = await c.post('/api/requests', requestPayload({ clientRequestId: crypto.randomUUID() }), write(token));
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.json.data.request.id, second.json.data.request.id);
});
