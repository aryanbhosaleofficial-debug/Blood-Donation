'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { closeDatabase } = require('../../src/core/database');
const { SESSION_COOKIE_NAME } = require('../../src/core/constants');

let srv;
const withOrigin = { headers: { Origin: ORIGIN } };

before(async () => {
  srv = await startTestServer();
});

after(async () => {
  await srv.close();
  closeDatabase();
});

test('F: /me is 401 before login, the user after login, and 401 again after logout', async () => {
  const user = await createTestUser({ email: 'lifecycle@example.com' });
  const client = srv.client();

  const before401 = await client.get('/api/auth/me');
  assert.equal(before401.status, 401);

  const login = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  assert.equal(login.status, 200);

  const meAfter = await client.get('/api/auth/me');
  assert.equal(meAfter.status, 200);
  assert.equal(meAfter.json.data.user.email, user.email);

  const csrf = (await client.get('/api/auth/csrf-token')).json.data.csrfToken;
  const logout = await client.post('/api/auth/logout', undefined, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': csrf },
  });
  assert.equal(logout.status, 200);

  const after401 = await client.get('/api/auth/me');
  assert.equal(after401.status, 401);
});

test('G: the session cookie is HttpOnly + SameSite=Lax and not Secure in dev', async () => {
  const user = await createTestUser({ email: 'cookie@example.com' });
  const client = srv.client();
  const res = await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);

  const cookie = res.setCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  assert.ok(cookie, 'a session cookie should be set on login');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.doesNotMatch(cookie, /Secure/i);
});

test('H: login regenerates the session id (fixation protection)', async () => {
  const user = await createTestUser({ email: 'fixation@example.com' });
  const client = srv.client();

  // Establish an anonymous session first.
  await client.get('/api/_test/touch-session');
  const anonId = client.cookie(SESSION_COOKIE_NAME);
  assert.ok(anonId, 'anonymous session cookie should exist after touching the session');

  await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  const authedId = client.cookie(SESSION_COOKIE_NAME);

  assert.ok(authedId);
  assert.notEqual(authedId, anonId);
});

test('a second login rotates the session id again', async () => {
  const user = await createTestUser({ email: 'relogin@example.com' });
  const client = srv.client();

  await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  const firstId = client.cookie(SESSION_COOKIE_NAME);
  await client.post('/api/auth/login', { email: user.email, password: user.password }, withOrigin);
  const secondId = client.cookie(SESSION_COOKIE_NAME);

  assert.notEqual(firstId, secondId);
});
