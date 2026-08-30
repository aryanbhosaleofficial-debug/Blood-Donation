'use strict';

require('../helpers/env');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { assertTransitionAllowed } = require('../../src/modules/requests/requests.policy');
const {
  CANCELABLE_FROM,
  COMPLETABLE_FROM,
  REQUEST_STATUS,
} = require('../../src/modules/requests/requests.constants');

test('Module 04 cancellation and completion source states are explicit', () => {
  assert.deepEqual([...CANCELABLE_FROM], [REQUEST_STATUS.OPEN, REQUEST_STATUS.COVERED]);
  assert.deepEqual([...COMPLETABLE_FROM], [REQUEST_STATUS.COVERED]);
});

test('assertTransitionAllowed permits OPEN cancellation and COVERED completion', () => {
  assert.doesNotThrow(() => assertTransitionAllowed(REQUEST_STATUS.OPEN, CANCELABLE_FROM));
  assert.doesNotThrow(() => assertTransitionAllowed(REQUEST_STATUS.COVERED, COMPLETABLE_FROM));
});

test('assertTransitionAllowed rejects terminal -> terminal with INVALID_REQUEST_STATE (409)', () => {
  for (const from of [
    REQUEST_STATUS.CANCELLED,
    REQUEST_STATUS.COMPLETED,
    REQUEST_STATUS.EXPIRED,
  ]) {
    assert.throws(
      () => assertTransitionAllowed(from, CANCELABLE_FROM),
      (err) => {
        assert.equal(err.code, 'INVALID_REQUEST_STATE');
        assert.equal(err.status, 409);
        return true;
      },
      `expected ${from} to be rejected`,
    );
  }
  assert.throws(() => assertTransitionAllowed(REQUEST_STATUS.OPEN, COMPLETABLE_FROM));
});

test('the request state model has exactly the five documented states', () => {
  assert.deepEqual(
    new Set(Object.values(REQUEST_STATUS)),
    new Set(['OPEN', 'COVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED']),
  );
});
