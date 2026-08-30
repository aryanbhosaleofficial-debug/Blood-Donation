'use strict';

/**
 * modules/auth/auth.repository
 *
 * SQL for the login/brute-force state on the `users` table. User creation and
 * generic lookups live in users.repository; this file owns the auth-specific
 * mutations (failed attempts + temporary lock).
 */

const { getDb } = require('../../core/database');

/**
 * Increment failed_login_attempts and return the new count.
 * @param {number} userId
 * @returns {number}
 */
function incrementFailedAttempts(userId) {
  const db = getDb();
  db.prepare(
    'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
  ).run(userId);
  const row = db.prepare('SELECT failed_login_attempts AS n FROM users WHERE id = ?').get(userId);
  return row ? row.n : 0;
}

/**
 * Set locked_until to an ISO-8601 UTC timestamp (or null to clear).
 * @param {number} userId
 * @param {string | null} lockedUntilIso
 */
function setLockedUntil(userId, lockedUntilIso) {
  getDb().prepare('UPDATE users SET locked_until = ? WHERE id = ?').run(lockedUntilIso, userId);
}

/** Reset failed_login_attempts to 0 and clear locked_until. */
function clearLoginState(userId) {
  getDb()
    .prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
    .run(userId);
}

module.exports = {
  incrementFailedAttempts,
  setLockedUntil,
  clearLoginState,
};
