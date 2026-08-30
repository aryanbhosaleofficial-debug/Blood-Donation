'use strict';

/**
 * modules/users/users.service
 *
 * User-centric business logic used by Module 01: creation (with hashing +
 * normalization + duplicate check) and lookups.
 */

const { ConflictError } = require('../../core/errors');
const { hashPassword } = require('../../security/password');
const usersRepository = require('./users.repository');
const { normalizeEmail, ROLE_VALUES } = require('./users.constants');
const serializer = require('./users.serializer');

async function createUser({ email, password, role, isVerified = false, isActive = true }) {
  const normalizedEmail = normalizeEmail(email);
  if (!ROLE_VALUES.includes(role)) {
    throw new Error(`createUser received an invalid role: ${role}`);
  }
  if (usersRepository.emailExists(normalizedEmail)) {
    throw new ConflictError('An account with that email already exists.', { code: 'EMAIL_TAKEN' });
  }
  const passwordHash = await hashPassword(password);
  return usersRepository.insertUser({
    email: normalizedEmail,
    passwordHash,
    role,
    isVerified,
    isActive,
  });
}

function findByEmail(email) {
  return usersRepository.findByEmail(normalizeEmail(email));
}

function findById(id) {
  return usersRepository.findById(id);
}

function isActive(row) {
  return serializer.toBoolean(row.is_active);
}

function isLocked(row, now = Date.now()) {
  if (!row.locked_until) {
    return false;
  }
  const until = Date.parse(row.locked_until);
  return Number.isFinite(until) && until > now;
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  isActive,
  isLocked,
  toSessionUser: serializer.toSessionUser,
  toPublicUser: serializer.toPublicUser,
};
