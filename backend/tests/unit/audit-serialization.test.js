'use strict';

/**
 * tests/unit/audit-serialization.test.js
 *
 * Module 08 — audit serializer shape (safe admin view of audit_logs rows).
 */

require('../helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');
const { serialize, serializePage } = require('../../src/modules/audit/audit.serializer');

const row = (over = {}) => ({
  id: 5,
  actor_user_id: 3,
  action: 'REQUEST_CREATED',
  entity_type: 'REQUEST',
  entity_id: 101,
  metadata_json: JSON.stringify({ urgency: 'CRITICAL', unitsNeeded: 2 }),
  created_at: '2026-08-31T10:00:00.000Z',
  ...over,
});

test('serialize maps snake_case columns and parses metadata JSON', () => {
  const out = serialize(row());
  assert.deepEqual(out, {
    id: 5,
    actorUserId: 3,
    action: 'REQUEST_CREATED',
    entityType: 'REQUEST',
    entityId: 101,
    metadata: { urgency: 'CRITICAL', unitsNeeded: 2 },
    createdAt: '2026-08-31T10:00:00.000Z',
  });
});

test('serialize tolerates null actor / entity and bad metadata JSON', () => {
  const out = serialize(row({ actor_user_id: null, entity_type: null, entity_id: null, metadata_json: '{bad' }));
  assert.equal(out.actorUserId, null);
  assert.equal(out.entityType, null);
  assert.equal(out.entityId, null);
  assert.deepEqual(out.metadata, { _parseError: true });
});

test('serialize never leaks a password / session field even if present in the row', () => {
  const out = serialize(row({ password_hash: 'x', session_id: 'y' }));
  const keys = Object.keys(out);
  assert.ok(!keys.some((k) => /password|session|hash/i.test(k)));
});

test('serializePage returns auditLogs + pagination with hasMore', () => {
  const page = serializePage([row(), row({ id: 6 })], 10, 2, 0);
  assert.equal(page.auditLogs.length, 2);
  assert.deepEqual(page.pagination, { total: 10, limit: 2, offset: 0, hasMore: true });

  const last = serializePage([row()], 3, 2, 2);
  assert.equal(last.pagination.hasMore, false);
});
