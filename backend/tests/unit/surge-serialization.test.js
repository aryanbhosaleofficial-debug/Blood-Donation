'use strict';

/**
 * tests/unit/surge-serialization.test.js
 *
 * Module 09 — candidate / event serializers expose only aggregate demand
 * evidence: no patient data, request notes, donor identity, or coordinates.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const { candidateView, candidatePage, eventView } = require('../../src/modules/surge/surge.serializer');

const row = (over = {}) => ({
  id: 15, mode: 'DEMO', city: 'Ahmedabad', blood_group: 'O-', component: 'RED_CELLS',
  window_started_at: '2026-08-31T09:00:00.000Z', window_ended_at: '2026-08-31T10:00:00.000Z',
  observed_request_count: 8, expected_lambda: 1.0, poisson_tail_probability: 0.0008,
  distinct_hospital_count: 3, velocity_ratio: 4, previous_window_count: 2,
  geographic_signal: 'CONCENTRATED', geographic_radius_km: 8.4,
  recorded_inventory_units: 4, fresh_inventory_rows: 3, stale_inventory_rows: 1,
  inventory_depletion_units: 9, signal_score: 86, baseline_source: 'SYNTHETIC',
  status: 'PENDING', is_synthetic: 1, dedupe_key: 'DEMO:AHMEDABAD:O-:RED_CELLS:123',
  detected_at: '2026-08-31T10:00:05.000Z', reviewed_at: null, reviewed_by_user_id: null, review_note: null,
  ...over,
});

test('candidateView maps evidence fields and is JSON-safe', () => {
  const v = candidateView(row());
  assert.equal(v.id, 15);
  assert.equal(v.observedRequests, 8);
  assert.equal(v.expectedRequests, 1);
  assert.equal(v.poissonTailProbability, 0.0008);
  assert.equal(v.distinctHospitals, 3);
  assert.equal(v.geographic.signal, 'CONCENTRATED');
  assert.equal(v.inventory.depletionUnits, 9);
  assert.equal(v.signalScore, 86);
  assert.equal(v.baselineSource, 'SYNTHETIC');
  assert.equal(v.isSynthetic, true);
});

test('candidateView never leaks patient data / donor contact / coordinates / secrets', () => {
  const raw = JSON.stringify(candidateView(row({
    // even if a bad row somehow carried these, the serializer is explicit and drops them
    note: 'patient bleeding heavily', donor_phone: '+91 90000 00000',
    latitude: 23.02, longitude: 72.57, password_hash: 's3cr3t', request_note: 'trauma ward',
  })));
  for (const secret of ['patient bleeding heavily', '+91 90000 00000', 's3cr3t', 'trauma ward', '23.02', '72.57']) {
    assert.ok(!raw.includes(secret), `must not expose "${secret}"`);
  }
  const lower = raw.toLowerCase();
  for (const key of ['phone', 'latitude', 'longitude', 'password', 'dedupe_key', 'request_note', '"note"']) {
    assert.ok(!lower.includes(key), `must not expose key "${key}"`);
  }
});

test('candidateView tolerates null', () => {
  assert.equal(candidateView(null), null);
});

test('candidatePage builds pagination with hasMore', () => {
  const page = candidatePage([row(), row({ id: 16 })], 10, 2, 0);
  assert.equal(page.candidates.length, 2);
  assert.deepEqual(page.pagination, { total: 10, limit: 2, offset: 0, hasMore: true });
});

test('eventView exposes only safe event fields', () => {
  const v = eventView({
    id: 3, candidate_id: 15, status: 'ACTIVE', city: 'Ahmedabad', blood_group: 'O-', component: 'RED_CELLS',
    summary: 'Unusual demand', admin_note: 'monitoring', confirmed_by_user_id: 7,
    confirmed_at: '2026-08-31T10:05:00.000Z', is_synthetic: 1, closed_at: null, created_at: '2026-08-31T10:05:00.000Z',
  });
  assert.equal(v.candidateId, 15);
  assert.equal(v.status, 'ACTIVE');
  assert.equal(v.isSynthetic, true);
  assert.ok(!('confirmed_by_user_id' in v));
});
