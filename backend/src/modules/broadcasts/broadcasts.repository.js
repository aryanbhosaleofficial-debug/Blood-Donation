'use strict';

/**
 * modules/broadcasts/broadcasts.repository
 *
 * SQL for `request_broadcasts`. Parameterized statements only.
 */

const { getDb } = require('../../core/database');

/**
 * Currently eligible broadcast targets: blood-bank users that are active AND
 * currently verified AND have an organization profile. Keyed off users.is_verified
 * / users.is_active, the same live signal requireVerified uses (so an admin
 * revocation is reflected without re-login).
 */
function eligibleBankIds(db) {
  return db
    .prepare(
      `SELECT b.id AS id
         FROM blood_banks b
         JOIN users u ON u.id = b.user_id
        WHERE u.role = 'BLOOD_BANK'
          AND u.is_active = 1
          AND u.is_verified = 1
        ORDER BY b.id`,
    )
    .all()
    .map((r) => r.id);
}

/** Returns eligible banks with user_id for notification recipient resolution. */
function eligibleBanksWithDetails(db) {
  return db
    .prepare(
      `SELECT b.id, b.user_id, b.name, b.city
         FROM blood_banks b
         JOIN users u ON u.id = b.user_id
        WHERE u.role = 'BLOOD_BANK'
          AND u.is_active = 1
          AND u.is_verified = 1
        ORDER BY b.id`,
    )
    .all();
}

function insert(db, requestId, bankId) {
  return db
    .prepare(`INSERT INTO request_broadcasts (request_id, bank_id) VALUES (?, ?)`)
    .run(requestId, bankId);
}

function countForRequest(requestId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM request_broadcasts WHERE request_id = ?').get(requestId).n;
}

function listForRequest(requestId) {
  return getDb()
    .prepare('SELECT * FROM request_broadcasts WHERE request_id = ? ORDER BY bank_id')
    .all(requestId);
}

function existsForBank(bankId, requestId) {
  return (
    getDb()
      .prepare('SELECT 1 AS x FROM request_broadcasts WHERE bank_id = ? AND request_id = ?')
      .get(bankId, requestId) != null
  );
}

/** Close every still-open broadcast for a request (on cancel/complete). */
function closeForRequest(db, requestId) {
  return db
    .prepare(
      `UPDATE request_broadcasts
          SET status = 'CLOSED',
              responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE request_id = ? AND status <> 'CLOSED'`,
    )
    .run(requestId);
}

module.exports = {
  eligibleBankIds,
  eligibleBanksWithDetails,
  insert,
  countForRequest,
  listForRequest,
  existsForBank,
  closeForRequest,
};
