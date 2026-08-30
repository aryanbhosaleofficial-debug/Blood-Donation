'use strict';

/**
 * Create users directly in the disposable test database, hashing passwords with
 * the real password service. No seed credentials are committed anywhere.
 */

const { getDb } = require('../../src/core/database');
const { hashPassword } = require('../../src/security/password');

const DEFAULT_PASSWORD = 'Sup3r-Secret-Passphrase';

async function createTestUser({
  email,
  password = DEFAULT_PASSWORD,
  role = 'HOSPITAL',
  isVerified = 1,
  isActive = 1,
} = {}) {
  const address = String(email || `user_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`).toLowerCase();
  const passwordHash = await hashPassword(password);
  const info = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, role, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(address, passwordHash, role, isVerified ? 1 : 0, isActive ? 1 : 0);

  return {
    id: Number(info.lastInsertRowid),
    email: address,
    password,
    role,
    isVerified: Boolean(isVerified),
    isActive: Boolean(isActive),
  };
}

/** Directly move a user's lock window into the past (simulate lock expiry). */
function expireLock(userId) {
  const past = new Date(Date.now() - 60_000).toISOString();
  getDb().prepare('UPDATE users SET locked_until = ? WHERE id = ?').run(past, userId);
}

function getUserRow(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

module.exports = { createTestUser, expireLock, getUserRow, DEFAULT_PASSWORD };
