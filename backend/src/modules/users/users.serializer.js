'use strict';

/**
 * modules/users/users.serializer
 *
 * Explicit whitelisting of user fields that may leave the server.
 * NEVER return password_hash, failed_login_attempts, locked_until, session ids
 * or CSRF internals.
 */

function toBoolean(value) {
  return value === 1 || value === true || value === '1';
}

/**
 * Public representation of a user. Accepts either a raw DB row (snake_case) or
 * the minimal session-user object (camelCase).
 * @param {object | null | undefined} user
 * @returns {{ id: number, email: string, role: string, isVerified: boolean } | null}
 */
function toPublicUser(user) {
  if (!user) {
    return null;
  }
  const isVerified =
    'isVerified' in user ? Boolean(user.isVerified) : toBoolean(user.is_verified);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified,
  };
}

/**
 * The minimal object stored in req.session.user. Deliberately tiny.
 * @param {object} row - a users table row
 */
function toSessionUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isVerified: toBoolean(row.is_verified),
  };
}

module.exports = { toPublicUser, toSessionUser, toBoolean };
