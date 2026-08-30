'use strict';

// This file runs in its own process (node --test isolates files), so we can
// pin a tiny login rate limit here without affecting the other suites.
process.env.LOGIN_RATE_LIMIT_MAX = '3';
require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
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

test('01.16: the login endpoint is IP rate limited', async () => {
  const user = await createTestUser({ email: 'rl@example.com' });
  const client = srv.client();

  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.post('/api/auth/login', { email: user.email, password: 'wrong-password-x' }, withOrigin);
    statuses.push(res.status);
  }

  // First few are normal auth failures; once the window limit (3) is exceeded
  // the limiter takes over with 429.
  assert.ok(statuses.slice(0, 3).every((s) => s === 401), `expected 401s, got ${statuses}`);
  const limited = statuses.slice(3);
  assert.ok(limited.includes(429), `expected a 429 after the limit, got ${statuses}`);

  const last = await client.post('/api/auth/login', { email: user.email, password: 'wrong-password-x' }, withOrigin);
  assert.equal(last.status, 429);
  assert.equal(last.json.error.code, 'TOO_MANY_REQUESTS');
});
