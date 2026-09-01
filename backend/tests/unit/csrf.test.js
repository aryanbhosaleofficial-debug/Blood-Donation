'use strict';

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateToken,
  getOrCreateToken,
  rotateToken,
  createCsrfMiddleware,
} = require('../../src/security/csrf');

const ORIGIN = 'http://localhost:3000';
const DEV_ORIGIN = 'http://localhost:5173';

function fakeReq({ method = 'POST', path = '/api/x', session = {}, headers = {} } = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { method, path, session, get: (name) => lower[String(name).toLowerCase()] };
}

function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err));
  });
}

test('generateToken returns a 64-char hex string and is unique', () => {
  const a = generateToken();
  const b = generateToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('getOrCreateToken stores on the session; rotateToken replaces it', () => {
  const req = fakeReq();
  const first = getOrCreateToken(req);
  assert.equal(req.session.csrfToken, first);
  assert.equal(getOrCreateToken(req), first);
  const rotated = rotateToken(req);
  assert.notEqual(rotated, first);
});

test('safe methods pass without any checks', async () => {
  const mw = createCsrfMiddleware();
  const err = await runMiddleware(mw, fakeReq({ method: 'GET', headers: {} }));
  assert.equal(err, undefined);
});

test('missing/invalid Origin is rejected with INVALID_ORIGIN', async () => {
  const mw = createCsrfMiddleware();
  const noOrigin = await runMiddleware(mw, fakeReq({ session: { csrfToken: 'x' }, headers: {} }));
  assert.equal(noOrigin.code, 'INVALID_ORIGIN');
  assert.equal(noOrigin.status, 403);

  const badOrigin = await runMiddleware(
    mw,
    fakeReq({ session: { csrfToken: 'x' }, headers: { Origin: 'http://evil.example', 'x-csrf-token': 'x' } }),
  );
  assert.equal(badOrigin.code, 'INVALID_ORIGIN');
});

test('exempt paths skip the token check but still need a valid Origin', async () => {
  const mw = createCsrfMiddleware({ exemptPaths: ['/api/auth/login'] });
  const ok = await runMiddleware(
    mw,
    fakeReq({ path: '/api/auth/login', session: {}, headers: { Origin: ORIGIN } }),
  );
  assert.equal(ok, undefined);

  const badOrigin = await runMiddleware(
    mw,
    fakeReq({ path: '/api/auth/login', session: {}, headers: { Origin: 'http://evil.example' } }),
  );
  assert.equal(badOrigin.code, 'INVALID_ORIGIN');
});

test('missing CSRF token is rejected', async () => {
  const mw = createCsrfMiddleware();
  const err = await runMiddleware(
    mw,
    fakeReq({ session: { csrfToken: 'session-token' }, headers: { Origin: ORIGIN } }),
  );
  assert.equal(err.code, 'INVALID_CSRF_TOKEN');
});

test('wrong CSRF token is rejected', async () => {
  const mw = createCsrfMiddleware();
  const err = await runMiddleware(
    mw,
    fakeReq({
      session: { csrfToken: 'session-token' },
      headers: { Origin: ORIGIN, 'x-csrf-token': 'different-token' },
    }),
  );
  assert.equal(err.code, 'INVALID_CSRF_TOKEN');
});

test('matching CSRF token + valid Origin passes', async () => {
  const mw = createCsrfMiddleware();
  const token = generateToken();
  const err = await runMiddleware(
    mw,
    fakeReq({ session: { csrfToken: token }, headers: { Origin: ORIGIN, 'x-csrf-token': token } }),
  );
  assert.equal(err, undefined);
});

test('the explicitly configured Vite development Origin passes', async () => {
  const mw = createCsrfMiddleware();
  const token = generateToken();
  const err = await runMiddleware(
    mw,
    fakeReq({ session: { csrfToken: token }, headers: { Origin: DEV_ORIGIN, 'x-csrf-token': token } }),
  );
  assert.equal(err, undefined);
});
