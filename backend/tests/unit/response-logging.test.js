'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { UnauthorizedError } = require('../../src/core/errors');
const { isExpectedUnauthenticatedProbe } = require('../../src/core/response');

test('logged-out GET /api/auth/me is classified as an expected auth bootstrap probe', () => {
  const res = { req: { method: 'GET', originalUrl: '/api/auth/me' } };
  const error = new UnauthorizedError('You must be signed in to do that.');
  assert.equal(isExpectedUnauthenticatedProbe(res, error, 401), true);
});

test('other unauthenticated requests remain security warnings', () => {
  const error = new UnauthorizedError('You must be signed in to do that.');
  assert.equal(
    isExpectedUnauthenticatedProbe(
      { req: { method: 'POST', originalUrl: '/api/requests' } },
      error,
      401,
    ),
    false,
  );
  assert.equal(
    isExpectedUnauthenticatedProbe(
      { req: { method: 'GET', originalUrl: '/api/admin/audit-logs' } },
      error,
      401,
    ),
    false,
  );
});
