'use strict';

/**
 * modules/users/users.repository
 *
 * All SQL for the `users` table. Parameterized statements only.
 */

const { getDb } = require('../../core/database');

const COLUMNS = `
  id, email, password_hash, role,
  is_verified, is_active,
  failed_login_attempts, locked_until,
  created_at, updated_at
`;

function findByEmail(email) {
  return getDb()
    .prepare(`SELECT ${COLUMNS} FROM users WHERE email = ?`)
    .get(email);
}

function findById(id) {
  return getDb()
    .prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`)
    .get(id);
}

function emailExists(email) {
  const row = getDb().prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email);
  return row != null;
}

/**
 * @param {{ email: string, passwordHash: string, role: string,
 *           isVerified?: boolean, isActive?: boolean }} data
 * @returns {object} the created row
 */
function insertUser(data) {
  const info = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, role, is_verified, is_active)
       VALUES (@email, @passwordHash, @role, @isVerified, @isActive)`,
    )
    .run({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      isVerified: data.isVerified ? 1 : 0,
      isActive: data.isActive === false ? 0 : 1,
    });
  return findById(Number(info.lastInsertRowid));
}

module.exports = {
  findByEmail,
  findById,
  emailExists,
  insertUser,
};
