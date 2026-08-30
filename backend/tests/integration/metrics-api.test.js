'use strict';

/**
 * tests/integration/metrics-api.test.js
 *
 * Tests for Module 08 operational metrics HTTP API.
 *
 * Test Groups:
 *   A – ADMIN can GET /api/admin/metrics and receives structured response
 *   B – Non-ADMIN is rejected (403)
 *   C – Unauthenticated is rejected (401)
 *   D – Response shape validation
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-metrics-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'metrics.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestUser } = require('../helpers/users');
const { startTestServer, loginAs } = require('../helpers/server');
const { closeDatabase } = require('../../src/core/database');

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.close(); closeDatabase(); });

async function adminClient() {
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  return { client, csrf };
}

async function hospitalClient() {
  const client = srv.client();
  const user = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  return { client, csrf };
}

// ─── Test Group A — Admin access ─────────────────────────────────────────

test('A: ADMIN can GET /api/admin/metrics (200)', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/metrics', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 200);
});

// ─── Test Group B — Role Protection ──────────────────────────────────────

test('B: HOSPITAL user is rejected from /api/admin/metrics (403)', async () => {
  const { client, csrf } = await hospitalClient();
  const res = await client.get('/api/admin/metrics', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 403);
});

// ─── Test Group C — Authentication ───────────────────────────────────────

test('C: unauthenticated request to /api/admin/metrics is rejected (401)', async () => {
  const anon = srv.client();
  const res = await anon.get('/api/admin/metrics');
  assert.equal(res.status, 401);
});

// ─── Test Group D — Response Shape ───────────────────────────────────────

test('D: /api/admin/metrics response has correct shape with all required sections', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/metrics', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 200);
  const { metrics } = res.json.data;

  // Top-level sections
  assert.ok(metrics.requests, 'must have requests section');
  assert.ok(metrics.allocations, 'must have allocations section');
  assert.ok(metrics.inventory, 'must have inventory section');
  assert.ok(metrics.donors, 'must have donors section');
  assert.ok(metrics.pledges, 'must have pledges section');
  assert.ok(metrics.notifications, 'must have notifications section');
  assert.ok(metrics.cleanup, 'must have cleanup section');
  assert.ok(metrics.workers, 'must have workers section');

  // Request fields
  assert.ok(typeof metrics.requests.total === 'number');
  assert.ok(typeof metrics.requests.open === 'number');
  assert.ok(typeof metrics.requests.expired === 'number');

  // Cleanup fields
  assert.ok(typeof metrics.cleanup.pastDueActiveRequests === 'number');
  assert.ok(typeof metrics.cleanup.expiredLocationSessionsRemaining === 'number');

  // Workers (may be 'stopped' in test mode)
  assert.ok(typeof metrics.workers.notification === 'string');
  assert.ok(typeof metrics.workers.requestExpiry === 'string');
  assert.ok(typeof metrics.workers.locationCleanup === 'string');

  // No PII in the response
  assert.ok(!JSON.stringify(metrics).includes('password'));
  assert.ok(!JSON.stringify(metrics).includes('email'));
  assert.ok(!JSON.stringify(metrics).includes('latitude'));
  assert.ok(!JSON.stringify(metrics).includes('longitude'));
});
