'use strict';

/**
 * Starts the real app on an ephemeral port and returns helpers for tests.
 * `require('./env')` must have run first.
 */

const { once } = require('node:events');
const express = require('express');

const { createApp } = require('../../src/app');
const { sendSuccess } = require('../../src/core/response');
const { requireAuth } = require('../../src/middleware/authenticate');
const { requireRole } = require('../../src/middleware/require-role');
const { createClient } = require('./http');

const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';

/**
 * Small set of protected routes used to exercise auth/role/CSRF middleware
 * without inventing a fake domain module. Only mounted inside tests.
 */
function mountTestRoutes(app) {
  const router = express.Router();
  // Writes to the session without authenticating, so tests can observe an
  // anonymous session id before login (session-fixation check).
  router.get('/touch-session', (req, res) => {
    req.session.touchedAt = Date.now();
    sendSuccess(res, { touched: true });
  });
  router.get('/whoami', requireAuth, (req, res) => sendSuccess(res, { user: req.session.user }));
  router.post('/echo', requireAuth, (req, res) => sendSuccess(res, { echoed: req.body ?? null }));
  router.post('/admin-only', requireRole('ADMIN'), (req, res) => sendSuccess(res, { ok: true }));
  router.post('/staff-only', requireRole('ADMIN', 'HOSPITAL'), (req, res) => sendSuccess(res, { ok: true }));
  app.use('/api/_test', router);
}

async function startTestServer() {
  const server = createApp({ mountExtra: mountTestRoutes }).listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    server,
    baseUrl,
    origin: ORIGIN,
    client: () => createClient(baseUrl),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Log in a client and return its bootstrapped CSRF token. */
async function loginAs(client, { email, password, origin = ORIGIN }) {
  const res = await client.post('/api/auth/login', { email, password }, { headers: { Origin: origin } });
  if (res.status !== 200) {
    throw new Error(`loginAs failed: ${res.status} ${JSON.stringify(res.json)}`);
  }
  const tokenRes = await client.get('/api/auth/csrf-token');
  return tokenRes.json.data.csrfToken;
}

module.exports = { startTestServer, loginAs, mountTestRoutes, ORIGIN };
