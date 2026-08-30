'use strict';

/**
 * security/password
 *
 * The only module that touches bcrypt. Controllers and services call these
 * helpers - never bcrypt directly.
 *
 * Policy:
 *   - minimum length: 12 characters
 *   - maximum input: 72 bytes (bcrypt silently truncates beyond this, so we
 *     reject longer input instead of hashing a truncated password)
 *   - work factor from config.bcryptRounds (default 12)
 */

const bcrypt = require('bcrypt');

const config = require('../core/config');
const { ValidationError } = require('../core/errors');

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;

/**
 * Throw a ValidationError if the password does not meet policy.
 * @param {unknown} password
 */
function assertPasswordPolicy(password) {
  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string.');
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new ValidationError(`Password must be at most ${PASSWORD_MAX_BYTES} bytes long.`);
  }
}

/**
 * Hash a password with bcrypt after enforcing the password policy.
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  assertPasswordPolicy(password);
  return bcrypt.hash(password, config.bcryptRounds);
}

/**
 * Verify a candidate password against a stored bcrypt hash.
 * Returns false (never throws) for any malformed input so callers can treat a
 * bad hash the same as a wrong password.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string' || hash === '') {
    return false;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
};
