'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, ORIGIN } = require('../helpers/server');
const { createTestUser, expireLock, getUserRow } = require('../helpers/users');
const { closeDatabase } = require('../../src/core/database');

let srv;
const withOrigin = { headers: { Origin: ORIGIN } };

before(async () => {
  srv = await startTestServer();
});

after(async () => {
  await srv.close();
  closeDatabase();
});

test('B: valid credentials return 200 with a safe user and no secrets', async () => {
  const user = await createTestUser({ email: 'valid@example.com', role: 'HOSPITAL' });
  const client = srv.client();

  const res = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);

  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.json.data.user).sort(), ['email', 'id', 'isVerified', 'role'].sort());
  assert.equal(res.json.data.user.email, user.email);
  assert.equal(res.json.data.user.role, 'HOSPITAL');
  assert.equal(res.text.includes('password_hash'), false);

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.json.data.user.email, user.email);
});

test('C: unknown email and wrong password produce identical public failures', async () => {
  const user = await createTestUser({ email: 'enum@example.com' });

  const unknown = await srv
    .client()
    .post('/api/auth/login', { email: 'nobody@example.com', password: 'not-the-password-1' }, withOrigin);
  const wrongPw = await srv
    .client()
    .post('/api/auth/login', { email: user.email, password: 'definitely-wrong-9' }, withOrigin);

  assert.equal(unknown.status, 401);
  assert.equal(wrongPw.status, 401);
  assert.deepEqual(unknown.json, wrongPw.json);
  assert.equal(unknown.json.error.code, 'INVALID_CREDENTIALS');
  assert.equal(unknown.json.error.message, 'Invalid email or password');
});

test('D: an inactive account cannot authenticate', async () => {
  const user = await createTestUser({ email: 'inactive@example.com', isActive: 0 });
  const res = await srv
    .client()
    .post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);

  assert.notEqual(res.status, 200);
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, 'ACCOUNT_INACTIVE');
});

test('E: repeated failures lock the account, and the lock survives a correct password', async () => {
  const user = await createTestUser({ email: 'lockme@example.com' });
  const client = srv.client();

  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.post('/api/auth/login', { email: user.email, password: `wrong-pass-${i}0` }, withOrigin);
    assert.equal(res.status, 401);
  }

  const locked = getUserRow(user.id);
  assert.ok(locked.failed_login_attempts >= 5);
  assert.ok(locked.locked_until, 'locked_until should be set');

  // Correct password while locked -> still rejected.
  const duringLock = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  assert.equal(duringLock.status, 401);
});

test('E: an expired lock recovers and a successful login resets the counters', async () => {
  const user = await createTestUser({ email: 'recover@example.com' });
  const client = srv.client();

  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await client.post('/api/auth/login', { email: user.email, password: `bad-guess-${i}0` }, withOrigin);
  }
  assert.ok(getUserRow(user.id).locked_until);

  expireLock(user.id); // move the lock window into the past

  const ok = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  assert.equal(ok.status, 200);

  const row = getUserRow(user.id);
  assert.equal(row.failed_login_attempts, 0);
  assert.equal(row.locked_until, null);
});

test('E: one failure then success does not lock', async () => {
  const user = await createTestUser({ email: 'oneoff@example.com' });
  const client = srv.client();

  await client.post('/api/auth/login', { email: user.email, password: 'wrong-once-99' }, withOrigin);
  const ok = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);

  assert.equal(ok.status, 200);
  assert.equal(getUserRow(user.id).failed_login_attempts, 0);
});

test('login requires a valid Origin (CSRF layer)', async () => {
  const user = await createTestUser({ email: 'origin@example.com' });

  const noOrigin = await srv.client().post('/api/auth/login', { email: user.email, password: user.password });
  assert.equal(noOrigin.status, 403);
  assert.equal(noOrigin.json.error.code, 'INVALID_ORIGIN');

  const badOrigin = await srv
    .client()
    .post('/api/auth/login', { email: user.email, password: user.password }, { headers: { Origin: 'http://evil.example' } });
  assert.equal(badOrigin.status, 403);
});
