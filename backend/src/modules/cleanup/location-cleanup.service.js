'use strict';

/**
 * modules/cleanup/location-cleanup.service
 *
 * Physically deletes expired temporary donor location sessions.
 *
 * Why DELETE (not soft-delete): exact live coordinates are intentionally
 * ephemeral and must not persist past their TTL, even as inactive rows
 * (08.25). This supplements Module 06 read-time privacy checks.
 *
 * Safe by design:
 *   - Deterministic batch (expires_at ASC, id ASC), bounded by batchSize.
 *   - Idempotent: a re-run simply finds fewer / no rows.
 *   - No coordinates are logged or audited.
 */

const logger = require('../../core/logger');
const config = require('../../core/config');
const { getDb } = require('../../core/database');
const cleanupRepo = require('./cleanup.repository');

/**
 * Delete one batch of expired location sessions.
 *
 * @param {object} [opts]
 * @param {import('better-sqlite3').Database} [opts.db]
 * @param {string} [opts.nowIso]
 * @param {number} [opts.batchSize]
 * @returns {{ scanned: number, deleted: number }}
 */
function processBatch({ db, nowIso, batchSize } = {}) {
  const conn = db ?? getDb();
  const now = nowIso ?? new Date().toISOString();
  const size = batchSize ?? config.locationCleanupBatchSize;

  const sessions = cleanupRepo.findExpiredLocationSessions(conn, { batchSize: size, nowIso: now });
  let deleted = 0;
  for (const session of sessions) {
    try {
      const result = cleanupRepo.deleteLocationSession(conn, session.id);
      if (result.changes > 0) deleted += 1;
    } catch (err) {
      logger.error('location cleanup: failed to delete session', { sessionId: session.id, message: err.message });
    }
  }
  return { scanned: sessions.length, deleted };
}

module.exports = { processBatch };
