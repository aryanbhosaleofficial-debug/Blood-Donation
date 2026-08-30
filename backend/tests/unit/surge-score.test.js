'use strict';

/**
 * tests/unit/surge-score.test.js
 *
 * Module 09 — the 0–100 ranking score. It is an operational ranking only,
 * NOT a probability of a disaster.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeScore } = require('../../src/modules/surge/surge-signals.service');
const { GEO_SIGNAL, SIGNAL_LEVEL } = require('../../src/modules/surge/surge.constants');

test('score is always within 0–100', () => {
  const s = computeScore({
    pTail: 0, observed: 50, distinctHospitals: 20, velocity: 99,
    geographic: GEO_SIGNAL.CONCENTRATED, inventory: { depletionUnits: 100 },
  });
  assert.ok(s.score >= 0 && s.score <= 100);
});

test('a strong multi-signal candidate scores higher than a weak one', () => {
  const strong = computeScore({
    pTail: 1e-5, observed: 8, distinctHospitals: 3, velocity: 4,
    geographic: GEO_SIGNAL.CONCENTRATED, inventory: { depletionUnits: 9 },
  });
  const weak = computeScore({
    pTail: 0.009, observed: 5, distinctHospitals: 1, velocity: 1,
    geographic: GEO_SIGNAL.UNAVAILABLE, inventory: { depletionUnits: 0 },
  });
  assert.ok(strong.score > weak.score, `${strong.score} !> ${weak.score}`);
});

test('E: a one-hospital spike scores lower on distribution evidence than a multi-hospital one', () => {
  const base = { pTail: 1e-4, observed: 8, velocity: 2, geographic: GEO_SIGNAL.UNAVAILABLE, inventory: { depletionUnits: 0 } };
  const oneHospital = computeScore({ ...base, distinctHospitals: 1 });
  const manyHospitals = computeScore({ ...base, distinctHospitals: 4 });
  assert.ok(manyHospitals.score > oneHospital.score);
});

test('level thresholds: LOW / MEDIUM / HIGH', () => {
  const low = computeScore({ pTail: 0.5, observed: 5, distinctHospitals: 0, velocity: 1, geographic: GEO_SIGNAL.UNAVAILABLE, inventory: { depletionUnits: 0 } });
  assert.equal(low.level, SIGNAL_LEVEL.LOW);
  const high = computeScore({ pTail: 0, observed: 20, distinctHospitals: 10, velocity: 5, geographic: GEO_SIGNAL.CONCENTRATED, inventory: { depletionUnits: 5 } });
  assert.equal(high.level, SIGNAL_LEVEL.HIGH);
});

test('NaN p-tail contributes no statistical weight (does not throw)', () => {
  const s = computeScore({ pTail: NaN, observed: 6, distinctHospitals: 2, velocity: 2, geographic: GEO_SIGNAL.SPREAD, inventory: { depletionUnits: 0 } });
  assert.ok(Number.isFinite(s.score));
});
