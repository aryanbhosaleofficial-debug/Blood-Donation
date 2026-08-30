'use strict';

/**
 * modules/auth/auth.service
 *
 * The login decision logic. Returns the user row on success; throws a generic
 * UnauthorizedError for every credential failure (unknown email, wrong
 * password, or a currently-locked account) so responses cannot be used to
 * enumerate accounts or probe lock state.
 */

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

const config = require('../../core/config');
const logger = require('../../core/logger');
const { UnauthorizedError, ForbiddenError } = require('../../core/errors');
const { verifyPassword } = require('../../security/password');
const usersService = require('../users/users.service');
const authRepository = require('./auth.repository');
const auditService = require('../audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');
const {
  INVALID_CREDENTIALS_CODE,
  INVALID_CREDENTIALS_MESSAGE,
  ACCOUNT_INACTIVE_CODE,
  ACCOUNT_INACTIVE_MESSAGE,
} = require('./auth.constants');

// A real bcrypt hash of a throwaway random value. Comparing against this when
// the account does not exist keeps the response time similar to the
// "user found" path, reducing timing-based enumeration.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), config.bcryptRounds);

function invalidCredentials() {
  return new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, { code: INVALID_CREDENTIALS_CODE });
}

/**
 * @param {{ email: string, password: string }} credentials  (already normalized by Zod)
 * @returns {Promise<object>} the authenticated user row
 */
async function authenticate({ email, password }) {
  const user = usersService.findByEmail(email);

  if (!user) {
    // Keep timing comparable to the found-user path.
    await verifyPassword(password, DUMMY_HASH);
    auditService.recordAudit({
      actorUserId: null,
      action: AUDIT_ACTION.AUTH_LOGIN_FAILED,
      entityType: AUDIT_ENTITY.USER,
      entityId: null,
      metadata: { reason: 'UNKNOWN_EMAIL' },
    });
    throw invalidCredentials();
  }

  // A locked account behaves exactly like a bad password (no lock disclosure).
  if (usersService.isLocked(user)) {
    logger.warn('login attempt on locked account', { userId: user.id });
    auditService.recordAudit({
      actorUserId: user.id,
      action: AUDIT_ACTION.AUTH_LOGIN_FAILED,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      metadata: { reason: 'ACCOUNT_LOCKED' },
    });
    throw invalidCredentials();
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    const attempts = authRepository.incrementFailedAttempts(user.id);
    auditService.recordAudit({
      actorUserId: user.id,
      action: AUDIT_ACTION.AUTH_LOGIN_FAILED,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      metadata: { reason: 'BAD_PASSWORD', failedAttempts: attempts },
    });
    if (attempts >= config.login.maxAttempts) {
      const lockedUntil = new Date(Date.now() + config.login.lockMinutes * 60 * 1000).toISOString();
      authRepository.setLockedUntil(user.id, lockedUntil);
      logger.warn('account locked after repeated failures', { userId: user.id, attempts });
      auditService.recordAudit({
        actorUserId: user.id,
        action: AUDIT_ACTION.AUTH_ACCOUNT_LOCKED,
        entityType: AUDIT_ENTITY.USER,
        entityId: user.id,
        metadata: { failedAttempts: attempts, lockMinutes: config.login.lockMinutes },
      });
    }
    throw invalidCredentials();
  }

  if (!usersService.isActive(user)) {
    // Distinct from a credential failure: the credentials were correct.
    throw new ForbiddenError(ACCOUNT_INACTIVE_MESSAGE, { code: ACCOUNT_INACTIVE_CODE });
  }

  // Success: reset brute-force counters.
  authRepository.clearLoginState(user.id);
  return { ...user, failed_login_attempts: 0, locked_until: null };
}

module.exports = { authenticate };
