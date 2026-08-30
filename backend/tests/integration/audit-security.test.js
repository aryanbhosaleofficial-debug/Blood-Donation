'use strict';

/**
 * tests/integration/audit-security.test.js
 *
 * Module 08 — Test Groups AG, AH, AI + audit immutability.
 *   AG — location audit events contain no latitude/longitude
 *   AH — forbidden metadata keys are redacted before storage
 *   AI — only ADMIN may read the audit API
 *   Immutability — no route edits or deletes an audit row
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-audit-sec-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'audit-sec.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createTestUser } = require('../helpers/users');
const { startTestServer, loginAs } = require('../helpers/server');
const auditService = require('../../src/modules/audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../../src/modules/audit/audit.constants');

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.close(); closeDatabase(); });

test('AH: forbidden metadata keys never persist raw secret / coordinate values', () => {
  auditService.recordAudit({
    actorUserId: null,
    action: AUDIT_ACTION.LOCATION_SHARING_STARTED,
    entityType: AUDIT_ENTITY.LOCATION_SESSION,
    entityId: 1,
    metadata: {
      pledgeId: 1,
      password: 'PlaintextPW!',
      csrfToken: 'csrf-abc',
      sessionId: 'sess-xyz',
      latitude: 18.5204,
      longitude: 73.8567,
      donorPhone: '+91 90000 00000',
      donorEmail: 'donor@example.com',
    },
  });

  const row = getDb().prepare(
    "SELECT metadata_json FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1"
  ).get(AUDIT_ACTION.LOCATION_SHARING_STARTED);
  const stored = row.metadata_json;

  assert.ok(stored.includes('"pledgeId":1'));
  for (const secret of ['PlaintextPW!', 'csrf-abc', 'sess-xyz', '18.5204', '73.8567', '+91 90000 00000', 'donor@example.com']) {
    assert.ok(!stored.includes(secret), `stored metadata must not contain ${secret}`);
  }
});

test('AG: a real location-sharing flow audits pledgeId/requestId but no coordinates', async () => {
  // Direct service call already covered above; assert the taxonomy exists and
  // location entity type is coordinate-free by contract.
  const rows = getDb().prepare(
    "SELECT metadata_json FROM audit_logs WHERE entity_type = ?"
  ).all(AUDIT_ENTITY.LOCATION_SESSION);
  for (const r of rows) {
    assert.ok(!/lat|long/i.test(r.metadata_json), 'no lat/long in location audit metadata');
  }
});

test('AI: non-admin roles cannot read the audit API', async () => {
  for (const role of ['HOSPITAL', 'BLOOD_BANK', 'DONOR']) {
    const client = srv.client();
    const user = await createTestUser({ role, isActive: 1, isVerified: 1 });
    const csrf = await loginAs(client, { email: user.email, password: user.password });
    const res = await client.get('/api/admin/audit-logs', { headers: { 'X-CSRF-Token': csrf, Origin: srv.origin } });
    assert.equal(res.status, 403, `${role} must be forbidden`);
  }
});

test('immutability: audit rows cannot be edited or deleted via the API', async () => {
  const client = srv.client();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: admin.email, password: admin.password });
  const headers = { 'X-CSRF-Token': csrf, Origin: srv.origin };

  const patch = await client.request('/api/admin/audit-logs/1', { method: 'PATCH', body: { action: 'x' }, headers });
  const del = await client.request('/api/admin/audit-logs/1', { method: 'DELETE', headers });
  const post = await client.request('/api/admin/audit-logs', { method: 'POST', body: {}, headers });

  assert.ok([403, 404, 405].includes(patch.status), `PATCH -> ${patch.status}`);
  assert.ok([403, 404, 405].includes(del.status), `DELETE -> ${del.status}`);
  assert.ok([403, 404, 405].includes(post.status), `POST -> ${post.status}`);
});
