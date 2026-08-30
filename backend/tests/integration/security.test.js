'use strict';

require('../helpers/env');

const fs = require('node:fs');
const path = require('node:path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;

before(async () => {
  srv = await startTestServer();
});

after(async () => {
  await srv.close();
  closeDatabase();
});

// --- CSRF -----------------------------------------------------------------

test('I: an authenticated unsafe request needs a valid CSRF token', async () => {
  const user = await createTestUser({ email: 'csrf@example.com' });
  const client = srv.client();
  const token = await loginAs(client, user);

  const missing = await client.post('/api/_test/echo', { a: 1 }, { headers: { Origin: ORIGIN } });
  assert.equal(missing.status, 403);
  assert.equal(missing.json.error.code, 'INVALID_CSRF_TOKEN');

  const wrong = await client.post('/api/_test/echo', { a: 1 }, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': 'not-the-real-token' },
  });
  assert.equal(wrong.status, 403);

  const good = await client.post('/api/_test/echo', { a: 1 }, {
    headers: { Origin: ORIGIN, 'X-CSRF-Token': token },
  });
  assert.equal(good.status, 200);

  const badOrigin = await client.post('/api/_test/echo', { a: 1 }, {
    headers: { Origin: 'http://evil.example', 'X-CSRF-Token': token },
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(badOrigin.json.error.code, 'INVALID_ORIGIN');
});

// --- Body size limit ----------------------------------------------------

test('the JSON body size limit is enforced', async () => {
  const big = { blob: 'x'.repeat(300 * 1024) };
  const res = await srv.client().post('/api/auth/login', big, { headers: { Origin: ORIGIN } });
  assert.equal(res.status, 413);
  assert.equal(res.json.error.code, 'PAYLOAD_TOO_LARGE');
});

// --- Security headers -------------------------------------------------

test('Helmet security headers are present on responses', async () => {
  const res = await srv.client().get('/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp, 'CSP header should be set');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(res.headers.get('x-frame-options'), 'X-Frame-Options should be set');
  assert.equal(res.headers.get('x-powered-by'), null);
});

// --- Validation --------------------------------------------------------

test('K: malformed login input is rejected with 400 VALIDATION_ERROR', async () => {
  const cases = [
    {},
    { password: 'a-valid-password' },
    { email: 'not-an-email', password: 'a-valid-password' },
    { email: 'someone@example.com' },
    { email: 'someone@example.com', password: 'short' },
    { email: 'someone@example.com', password: 'x'.repeat(200) },
  ];
  for (const body of cases) {
    // eslint-disable-next-line no-await-in-loop
    const res = await srv.client().post('/api/auth/login', body, { headers: { Origin: ORIGIN } });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assert.equal(res.json.error.code, 'VALIDATION_ERROR');
    assert.equal(typeof res.json.error.message, 'string');
    assert.equal('stack' in res.json.error, false);
  }
});

test('malformed JSON returns a clean 400', async () => {
  const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: '{ not valid json',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

// --- Error handling / no stack leakage --------------------------------

test('error responses never include a stack trace', async () => {
  const res = await srv.client().get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.json.error.code, 'NOT_FOUND');
  assert.equal(res.text.toLowerCase().includes('at object.'), false);
  assert.equal(res.text.toLowerCase().includes('.js:'), false);
});

// --- Module 00 regression -------------------------------------------

test('N: GET /api/health still returns 200', async () => {
  const res = await srv.client().get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.data.status, 'ok');
});

test('N: SQLite still has foreign_keys = ON and journal_mode = WAL', () => {
  const db = getDb();
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(String(db.pragma('journal_mode', { simple: true })).toLowerCase(), 'wal');
});

// --- Frontend XSS-safety guard --------------------------------------

test('M: no frontend module renders API data with innerHTML', () => {
  const frontendDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        const src = fs.readFileSync(full, 'utf8');
        if (/\.innerHTML\s*=/.test(src) || /insertAdjacentHTML/.test(src)) {
          offenders.push(full);
        }
      }
    }
  };
  walk(frontendDir);
  assert.deepEqual(offenders, [], `innerHTML/insertAdjacentHTML found in: ${offenders.join(', ')}`);
});
