'use strict';

/**
 * modules/cleanup/cleanup.repository
 *
 * Database queries supporting cleanup jobs.
 * All writes are performed inside transactions in request-expiry.transaction.js.
 */

const { ACTIVE_REQUEST_STATUSES } = require('./cleanup.constants');

/**
 * Find a batch of expired requests still in an active coordination state.
 * Results are ordered oldest-expiry-first for deterministic processing.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {number} opts.batchSize
 * @param {string} opts.nowIso  — current UTC ISO string (injectable for testing)
 * @returns {object[]}
 */
function findExpiredRequests(db, { batchSize, nowIso }) {
  const placeholders = ACTIVE_REQUEST_STATUSES.map(() => '?').join(', ');
  return db.prepare(`
    SELECT * FROM requests
    WHERE status IN (${placeholders})
      AND expires_at <= ?
    ORDER BY expires_at ASC, id ASC
    LIMIT ?
  `).all(...ACTIVE_REQUEST_STATUSES, nowIso, batchSize);
}

/**
 * Count active requests that are past their expiry time.
 * Used by the metrics endpoint to report cleanup backlog.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} nowIso
 * @returns {number}
 */
function countPastDueActiveRequests(db, nowIso) {
  const placeholders = ACTIVE_REQUEST_STATUSES.map(() => '?').join(', ');
  return db.prepare(`
    SELECT COUNT(*) AS n FROM requests
    WHERE status IN (${placeholders}) AND expires_at <= ?
  `).get(...ACTIVE_REQUEST_STATUSES, nowIso).n;
}

/**
 * Find a batch of expired location sessions for deletion.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {number} opts.batchSize
 * @param {string} opts.nowIso
 * @returns {object[]}
 */
function findExpiredLocationSessions(db, { batchSize, nowIso }) {
  return db.prepare(`
    SELECT * FROM donor_location_sessions
    WHERE expires_at <= ?
    ORDER BY expires_at ASC, id ASC
    LIMIT ?
  `).all(nowIso, batchSize);
}

/**
 * Delete a specific location session by id.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} sessionId
 * @returns {{ changes: number }}
 */
function deleteLocationSession(db, sessionId) {
  return db.prepare('DELETE FROM donor_location_sessions WHERE id = ?').run(sessionId);
}

/**
 * Count expired location sessions remaining (metrics).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} nowIso
 * @returns {number}
 */
function countExpiredLocationSessions(db, nowIso) {
  return db.prepare(
    'SELECT COUNT(*) AS n FROM donor_location_sessions WHERE expires_at <= ?'
  ).get(nowIso).n;
}

module.exports = {
  findExpiredRequests,
  countPastDueActiveRequests,
  findExpiredLocationSessions,
  deleteLocationSession,
  countExpiredLocationSessions,
};
