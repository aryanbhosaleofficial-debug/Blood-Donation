'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { closeDatabase } = require('../../src/core/database');
const { requireRole } = require('../../src/middleware/require-role');

let srv;

before(async () => {
  srv = await startTestServer();
});

after(async () => {
  await srv.close();
  closeDatabase();
});

test('J: requireAuth returns 401 for an anonymous request', async () => {
  const res = await srv.client().get('/api/_test/whoami');
  assert.equal(res.status, 401);
  assert.equal(res.json.error.code, 'UNAUTHORIZED');
});

test('J: requireAuth allows an authenticated request', async () => {
  const user = await createTestUser({ email: 'authed@example.com', role: 'DONOR' });
  const client = srv.client();
  await loginAs(client, user);

  const res = await client.get('/api/_test/whoami');
  assert.equal(res.status, 200);
  assert.equal(res.json.data.user.role, 'DONOR');
});

test('J: requireRole returns 403 for the wrong role and 200 for an allowed role', async () => {
  const donor = await createTestUser({ email: 'donor-role@example.com', role: 'DONOR' });
  const admin = await createTestUser({ email: 'admin-role@example.com', role: 'ADMIN' });

  const donorClient = srv.client();
  const donorToken = await loginAs(donorClient, donor);
  const denied = await donorClient.post('/api/_test/admin-only', {}, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': donorToken },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.code, 'FORBIDDEN');

  const adminClient = srv.client();
  const adminToken = await loginAs(adminClient, admin);
  const allowed = await adminClient.post('/api/_test/admin-only', {}, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': adminToken },
  });
  assert.equal(allowed.status, 200);
});

test('J: requireRole with multiple roles admits any of them', async () => {
  const hospital = await createTestUser({ email: 'hospital-role@example.com', role: 'HOSPITAL' });
  const client = srv.client();
  const token = await loginAs(client, hospital);

  const staff = await client.post('/api/_test/staff-only', {}, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': token },
  });
  assert.equal(staff.status, 200);

  const adminOnly = await client.post('/api/_test/admin-only', {}, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': token },
  });
  assert.equal(adminOnly.status, 403);
});

test('requireRole rejects unknown role names at wiring time', () => {
  assert.throws(() => requireRole('WIZARD'), /unknown role/i);
  assert.throws(() => requireRole(), /at least one role/i);
});
