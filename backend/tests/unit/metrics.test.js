'use strict';

/**
 * tests/unit/metrics.test.js
 *
 * Module 08 — metrics serializer: aggregate shape, number coercion,
 * synthetic/non-synthetic separation, no PII, no surge fields.
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const { serialize } = require('../../src/modules/metrics/metrics.serializer');

const raw = {
  requests: {
    total: 6, open: 2, covered: 1, completed: 1, cancelled: 1, expired: 1,
    synthetic: 2, nonSynthetic: 4,
    urgencyNormal: 1, urgencyUrgent: 2, urgencyCritical: 3,
  },
  allocations: { total: 3, reserved: 1, released: 1, completed: 1, totalUnitsReserved: 7 },
  inventory: { totalRecordedRedCellUnits: 40, staleInventoryRows: 2, freshInventoryRows: 6 },
  donors: { totalDonorProfiles: 5, available: 3, unavailable: 1, unknown: 1 },
  alerts: { activeDonorAlerts: 2 },
  pledges: { activePledges: 1, arrivedPledges: 1, cancelledPledges: 0, expiredPledges: 2, deferredPledges: 0, closedPledges: 1 },
  notifications: { queued: 4, sent: 10, failed: 1, unread: 3 },
  cleanup: { pastDueActiveRequests: 1, expiredLocationSessionsRemaining: 0, lastRequestExpiryRunAt: null, lastLocationCleanupRunAt: null },
  workers: { notification: 'running', requestExpiry: 'stopped', locationCleanup: 'running' },
};

test('serialize produces every required section', () => {
  const m = serialize(raw);
  for (const section of ['requests', 'allocations', 'inventory', 'donors', 'pledges', 'notifications', 'cleanup', 'workers']) {
    assert.ok(m[section], `missing ${section}`);
  }
});

test('serialize keeps synthetic and non-synthetic request counts distinct', () => {
  const m = serialize(raw);
  assert.equal(m.requests.synthetic, 2);
  assert.equal(m.requests.nonSynthetic, 4);
  assert.notEqual(m.requests.synthetic, m.requests.total);
});

test('serialize coerces null/undefined aggregate values to 0', () => {
  const m = serialize({ ...raw, allocations: {}, notifications: {} });
  assert.equal(m.allocations.total, 0);
  assert.equal(m.allocations.totalUnitsReserved, 0);
  assert.equal(m.notifications.failed, 0);
});

test('serialize output contains no PII and no raw statistical / surge-evidence fields', () => {
  const s = JSON.stringify(serialize(raw));
  // No personal data and no raw anomaly-model internals. The Module 09 `surge`
  // section is aggregate COUNTS only (pending/confirmed/rejected/active) — the
  // per-candidate evidence (lambda, p-value, score) is never in metrics.
  for (const bad of ['phone', 'email', 'latitude', 'longitude', 'password', 'note',
    'lambda', 'zscore', 'anomaly', 'poisson', 'ptail', 'signalscore', 'observedrequests']) {
    assert.ok(!s.toLowerCase().includes(bad), `must not expose ${bad}`);
  }
});

test('serialize surge section is aggregate counts only', () => {
  const m = serialize(raw);
  assert.deepEqual(Object.keys(m.surge).sort(), [
    'activeSurgeEvents', 'candidatesLast24Hours', 'confirmedCandidates',
    'pendingCandidates', 'rejectedCandidates', 'staleCandidates',
  ]);
  for (const v of Object.values(m.surge)) assert.equal(typeof v, 'number');
});

test('serialize byUrgency breakdown is present and numeric', () => {
  const m = serialize(raw);
  assert.deepEqual(m.requests.byUrgency, { normal: 1, urgent: 2, critical: 3 });
});
