'use strict';

/**
 * modules/audit/audit.service
 *
 * Public API for recording audit events.
 *
 * Design decisions:
 *   - recordAudit() can be called with an optional `db` for transaction participation.
 *   - When called without `db`, uses the shared application connection.
 *   - Failures are logged but do not propagate — audit must not break domain logic.
 *   - When called inside a domain transaction (with db), the audit row rolls back
 *     with the transaction if the business logic fails.
 */

const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const repo = require('./audit.repository');
const { safeMetadata } = require('./audit.sanitizer');

/**
 * Record an audit event.
 *
 * @param {object} opts
 * @param {import('better-sqlite3').Database} [opts.db]  — provide for transaction participation
 * @param {number|null}  [opts.actorUserId]
 * @param {string}       opts.action   — AUDIT_ACTION value
 * @param {string|null}  [opts.entityType]
 * @param {number|null}  [opts.entityId]
 * @param {object}       [opts.metadata] — safe, explicitly-constructed data only
 * @returns {object|null} inserted row, or null on failure
 */
function recordAudit({ db, actorUserId = null, action, entityType = null, entityId = null, metadata = {} }) {
  const conn = db ?? getDb();
  const safe = safeMetadata(metadata, { action, entityType });
  try {
    return repo.insert(conn, { actorUserId, action, entityType, entityId, metadata: safe });
  } catch (err) {
    // Audit failure must not crash domain logic outside transactions.
    logger.error('audit insert failed', { action, entityType, entityId, message: err.message });
    return null;
  }
}

/**
 * Query audit logs with validated filters.
 * Delegates to the repository.
 */
function queryAuditLogs({ db, ...filters } = {}) {
  const conn = db ?? getDb();
  return repo.query(conn, filters);
}

module.exports = { recordAudit, queryAuditLogs };
