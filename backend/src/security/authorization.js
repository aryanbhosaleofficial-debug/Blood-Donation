'use strict';

/**
 * security/authorization
 *
 * Generic, reusable authorization helpers. Module 01 only knows about
 * authentication and roles - no resource-ownership logic (that arrives with the
 * domain tables in later modules).
 */

const { UnauthorizedError, ForbiddenError } = require('../core/errors');

/** The minimal user object stored on the session, or null. */
function getSessionUser(req) {
  return (req && req.session && req.session.user) || null;
}

function isAuthenticated(req) {
  return getSessionUser(req) !== null;
}

/** Return the session user or throw UnauthorizedError. */
function assertAuthenticated(req) {
  const user = getSessionUser(req);
  if (!user) {
    throw new UnauthorizedError('You must be signed in to do that.');
  }
  return user;
}

function hasAnyRole(req, roles) {
  const user = getSessionUser(req);
  return user !== null && roles.includes(user.role);
}

/** Assert the session user has one of `roles` (401 if anonymous, 403 if wrong role). */
function assertRole(req, roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  const user = assertAuthenticated(req);
  if (!list.includes(user.role)) {
    throw new ForbiddenError('You do not have permission to perform this action.');
  }
  return user;
}

module.exports = {
  getSessionUser,
  isAuthenticated,
  assertAuthenticated,
  hasAnyRole,
  assertRole,
};
