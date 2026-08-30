'use strict';

/**
 * tests/integration/audit.test.js
 *
 * Tests for Module 08 audit log HTTP API.
 *
 * Test Groups:
 *   A – ADMIN can query empty audit log
 *   B – ADMIN can query with pagination defaults
 *   C – Non-ADMIN is rejected (403)
 *   D – Unauthenticated is rejected (401)
 *   E – Filtering by action
 *   F – Invalid filter parameters are rejected (400)
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-audit-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'audit.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestUser } = require('../helpers/users');
const { startTestServer, loginAs } = require('../helpers/server');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.close(); closeDatabase(); });

async function adminClient() {
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  return { client, csrf, user };
}

async function hospitalClient() {
  const client = srv.client();
  const user = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  return { client, csrf };
}

// ─── Test Group A — Empty Audit Log ──────────────────────────────────────

test('A: ADMIN can GET /api/admin/audit-logs and receives paginated result', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/audit-logs', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 200);
  const data = res.json.data;
  assert.ok(Array.isArray(data.auditLogs));
  assert.ok(typeof data.pagination === 'object');
  assert.ok(typeof data.pagination.total === 'number');
  assert.ok(typeof data.pagination.limit === 'number');
  assert.ok(typeof data.pagination.offset === 'number');
});

// ─── Test Group C — Role Protection ──────────────────────────────────────

test('C: HOSPITAL user is rejected from /api/admin/audit-logs (403)', async () => {
  const { client, csrf } = await hospitalClient();
  const res = await client.get('/api/admin/audit-logs', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 403);
});

// ─── Test Group D — Authentication ───────────────────────────────────────

test('D: unauthenticated request to /api/admin/audit-logs is rejected (401)', async () => {
  const anon = srv.client();
  const res = await anon.get('/api/admin/audit-logs');
  assert.equal(res.status, 401);
});

// ─── Test Group E — Filtering by Action ──────────────────────────────────

test('E: filtering by action=AUTH_LOGIN_SUCCEEDED returns only matching logs', async () => {
  const { client, csrf } = await adminClient();

  const res = await client.get('/api/admin/audit-logs?action=AUTH_LOGIN_SUCCEEDED', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 200);
  const { auditLogs } = res.json.data;
  for (const log of auditLogs) {
    assert.equal(log.action, 'AUTH_LOGIN_SUCCEEDED');
  }
});

// ─── Test Group F — Validation ───────────────────────────────────────────

test('F: invalid action filter parameter returns 400', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/audit-logs?action=INVALID_ACTION_XYZ', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 400);
});

test('F2: limit above 200 is rejected with 400', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/audit-logs?limit=999', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 400);
});

test('F3: negative offset is rejected with 400', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/audit-logs?offset=-1', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 400);
});

// ─── Test Group Z — Authentication audit integration ─────────────────────

test('Z: successful login writes an AUTH_LOGIN_SUCCEEDED audit row', async () => {
  const client = srv.client();
  const user = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });
  await loginAs(client, { email: user.email, password: user.password });

  const row = getDb().prepare(
    "SELECT * FROM audit_logs WHERE action = 'AUTH_LOGIN_SUCCEEDED' AND actor_user_id = ?"
  ).get(user.id);
  assert.ok(row, 'login success audited');
  assert.equal(row.entity_type, 'USER');
  const meta = JSON.parse(row.metadata_json);
  assert.equal(meta.role, 'HOSPITAL');
  assert.ok(!row.metadata_json.toLowerCase().includes('password'));
});

test('Z2: a failed login writes AUTH_LOGIN_FAILED without storing the password', async () => {
  const client = srv.client();
  const user = await createTestUser({ role: 'DONOR', isActive: 1, isVerified: 1 });
  const res = await client.post('/api/auth/login', { email: user.email, password: 'WrongPassword-123' }, { headers: { Origin: srv.origin } });
  assert.equal(res.status, 401);

  const row = getDb().prepare(
    "SELECT * FROM audit_logs WHERE action = 'AUTH_LOGIN_FAILED' AND actor_user_id = ? ORDER BY id DESC LIMIT 1"
  ).get(user.id);
  assert.ok(row, 'login failure audited');
  assert.equal(JSON.parse(row.metadata_json).reason, 'BAD_PASSWORD');
  assert.ok(!row.metadata_json.includes('WrongPassword-123'));
});

test('Z3: logout writes an AUTH_LOGOUT audit row', async () => {
  const client = srv.client();
  const user = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: user.email, password: user.password });
  const res = await client.post('/api/auth/logout', {}, { headers: { 'X-CSRF-Token': csrf, Origin: srv.origin } });
  assert.equal(res.status, 200);

  const row = getDb().prepare(
    "SELECT * FROM audit_logs WHERE action = 'AUTH_LOGOUT' AND actor_user_id = ?"
  ).get(user.id);
  assert.ok(row, 'logout audited');
});

// ─── Test Group AA — Organization audit integration ──────────────────────

test('AA: verifying then revoking an organization writes matching audit rows', async () => {
  const client = srv.client();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const csrf = await loginAs(client, { email: admin.email, password: admin.password });
  const headers = { 'X-CSRF-Token': csrf, Origin: srv.origin };

  const hospitalUser = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 0 });
  getDb().prepare(
    `INSERT INTO hospitals (user_id, name, registration_reference, contact_name, contact_phone, address, city, locality, pin_code)
     VALUES (?, 'Audit Hospital', 'REG-AA-1', 'C', '+91 99999 99999', 'Rd', 'Pune', 'X', '411001')`
  ).run(hospitalUser.id);

  const v = await client.post(`/api/admin/organizations/${hospitalUser.id}/verify`, {}, { headers });
  assert.equal(v.status, 200);
  const r = await client.post(`/api/admin/organizations/${hospitalUser.id}/revoke`, {}, { headers });
  assert.equal(r.status, 200);

  const verified = getDb().prepare(
    "SELECT * FROM audit_logs WHERE action = 'ORGANIZATION_VERIFIED' AND entity_id = ?"
  ).get(hospitalUser.id);
  const revoked = getDb().prepare(
    "SELECT * FROM audit_logs WHERE action = 'ORGANIZATION_VERIFICATION_REVOKED' AND entity_id = ?"
  ).get(hospitalUser.id);
  assert.ok(verified, 'verify audited');
  assert.ok(revoked, 'revoke audited');
  assert.equal(verified.actor_user_id, admin.id);
});

// ─── Test Group Y — Audit rolls back with its domain transaction ─────────

test('Y: an audit row inserted inside a domain transaction rolls back with it', () => {
  const db = getDb();
  const auditRepo = require('../../src/modules/audit/audit.repository');
  const before = db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'REQUEST_CREATED'").get().n;

  assert.throws(() => {
    db.transaction(() => {
      auditRepo.insert(db, { actorUserId: null, action: 'REQUEST_CREATED', entityType: 'REQUEST', entityId: 999999, metadata: { rolledBack: true } });
      throw new Error('force rollback');
    })();
  });

  const after = db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'REQUEST_CREATED'").get().n;
  assert.equal(after, before); // audit row did not persist
});

// ─── Test Group AJ — Pagination bounds & ordering ────────────────────────

test('AJ: audit results are newest-first and capped at the requested limit', async () => {
  const { client, csrf } = await adminClient();
  const res = await client.get('/api/admin/audit-logs?limit=3', {
    headers: { 'X-CSRF-Token': csrf, Origin: srv.origin },
  });
  assert.equal(res.status, 200);
  const { auditLogs, pagination } = res.json.data;
  assert.ok(auditLogs.length <= 3);
  assert.equal(pagination.limit, 3);
  for (let i = 1; i < auditLogs.length; i += 1) {
    assert.ok(auditLogs[i - 1].createdAt >= auditLogs[i].createdAt
      || auditLogs[i - 1].id > auditLogs[i].id);
  }
});
