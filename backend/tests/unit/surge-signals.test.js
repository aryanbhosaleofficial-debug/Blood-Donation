'use strict';

/**
 * tests/unit/surge-signals.test.js
 *
 * Module 09 — supporting signals (Test Groups D–J at the unit level).
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  velocityRatio, geographicSignal, inventorySignal,
} = require('../../src/modules/surge/surge-signals.service');
const { GEO_SIGNAL } = require('../../src/modules/surge/surge.constants');

test('velocityRatio: current 8 vs previous 2 -> 4.0', () => {
  assert.equal(velocityRatio(8, 2), 4);
});

test('velocityRatio: previous 0 is treated as 1 (no divide-by-zero)', () => {
  assert.equal(velocityRatio(6, 0), 6);
  assert.ok(Number.isFinite(velocityRatio(6, 0)));
});

test('velocityRatio is bounded', () => {
  assert.equal(velocityRatio(1000, 1), 99);
});

test('F: hospitals within the radius report CONCENTRATED', () => {
  const g = geographicSignal([
    { latitude: 23.02, longitude: 72.57 },
    { latitude: 23.04, longitude: 72.59 },
    { latitude: 23.03, longitude: 72.58 },
  ]);
  assert.equal(g.signal, GEO_SIGNAL.CONCENTRATED);
  assert.ok(g.radiusKm >= 0 && g.radiusKm < 15);
  assert.equal(g.located, 3);
});

test('G: widely separated hospitals report SPREAD, not concentrated', () => {
  const g = geographicSignal([
    { latitude: 23.02, longitude: 72.57 },  // Ahmedabad
    { latitude: 19.07, longitude: 72.87 },  // Mumbai
  ]);
  assert.equal(g.signal, GEO_SIGNAL.SPREAD);
  assert.ok(g.radiusKm > 15);
});

test('H: fewer than two located hospitals -> UNAVAILABLE (no crash, no invented coords)', () => {
  const g = geographicSignal([
    { latitude: null, longitude: null },
    { latitude: 23.02, longitude: 72.57 },
  ]);
  assert.equal(g.signal, GEO_SIGNAL.UNAVAILABLE);
  assert.equal(g.radiusKm, null);
});

test('I: recorded matching-inventory depletion is surfaced', () => {
  const inv = inventorySignal([{ unitsAvailable: 4, updatedAt: new Date().toISOString() }], 9);
  assert.equal(inv.depletionUnits, 9);
  assert.equal(inv.recordedUnits, 4);
  assert.equal(inv.freshRows, 1);
});

test('J: stale inventory rows are counted separately and excluded from recorded units', () => {
  const old = new Date(Date.now() - 999 * 60 * 1000).toISOString(); // well past stale threshold
  const fresh = new Date().toISOString();
  const inv = inventorySignal([
    { unitsAvailable: 10, updatedAt: old },
    { unitsAvailable: 3, updatedAt: fresh },
  ], 0);
  assert.equal(inv.staleRows, 1);
  assert.equal(inv.freshRows, 1);
  assert.equal(inv.recordedUnits, 3); // only the fresh row
});
