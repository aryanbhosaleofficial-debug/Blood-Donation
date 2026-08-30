'use strict';

/**
 * tests/unit/poisson.test.js
 *
 * Module 09 — Poisson upper-tail helper. The tail is the probability of
 * observing this many or more requests under the baseline model — NOT a
 * probability of a disaster.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const { poissonUpperTail, poissonPmf } = require('../../src/modules/surge/poisson.service');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('lambda = 0, k = 0 -> tail = 1', () => {
  assert.equal(poissonUpperTail(0, 0), 1);
});

test('lambda = 0, k > 0 -> tail = 0', () => {
  assert.equal(poissonUpperTail(1, 0), 0);
  assert.equal(poissonUpperTail(5, 0), 0);
});

test('k <= 0 -> tail = 1 for any lambda', () => {
  assert.equal(poissonUpperTail(0, 3), 1);
  assert.equal(poissonUpperTail(-2, 3), 1);
});

test('known values match an independent calculation (tolerance)', () => {
  // lambda = 1: P(X>=1) = 1 - e^-1 = 0.6321205588
  assert.ok(near(poissonUpperTail(1, 1), 1 - Math.exp(-1), 1e-9));
  // lambda = 2: P(X>=3) = 1 - e^-2 (1 + 2 + 2) = 1 - 5 e^-2 = 0.32332358...
  assert.ok(near(poissonUpperTail(3, 2), 1 - 5 * Math.exp(-2), 1e-9));
  // lambda = 1, k = 8 -> extremely small but positive
  const t = poissonUpperTail(8, 1);
  assert.ok(t > 0 && t < 1e-4, `expected tiny positive tail, got ${t}`);
});

test('monotonic: P(X >= k+1) <= P(X >= k) for fixed lambda', () => {
  const lambda = 2.5;
  let prev = poissonUpperTail(0, lambda);
  for (let k = 1; k <= 15; k += 1) {
    const cur = poissonUpperTail(k, lambda);
    assert.ok(cur <= prev + 1e-12, `k=${k}: ${cur} > ${prev}`);
    prev = cur;
  }
});

test('invalid inputs (NaN / Infinity / negative lambda) return NaN', () => {
  assert.ok(Number.isNaN(poissonUpperTail(NaN, 1)));
  assert.ok(Number.isNaN(poissonUpperTail(3, NaN)));
  assert.ok(Number.isNaN(poissonUpperTail(Infinity, 1)));
  assert.ok(Number.isNaN(poissonUpperTail(3, -1)));
});

test('result always within [0, 1] for valid input', () => {
  for (const lambda of [0.01, 0.5, 1, 3, 10]) {
    for (let k = 0; k <= 20; k += 1) {
      const t = poissonUpperTail(k, lambda);
      assert.ok(t >= 0 && t <= 1, `lambda=${lambda} k=${k} -> ${t}`);
    }
  }
});

test('poissonPmf sums to ~1 over a wide range and matches recurrence', () => {
  const lambda = 3;
  let sum = 0;
  for (let i = 0; i <= 40; i += 1) sum += poissonPmf(i, lambda);
  assert.ok(near(sum, 1, 1e-9));
  assert.equal(poissonPmf(0, 0), 1);
  assert.equal(poissonPmf(2, 0), 0);
});
