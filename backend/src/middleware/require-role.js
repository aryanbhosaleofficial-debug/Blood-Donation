'use strict';

/**
 * middleware/require-role
 *
 *   requireRole('ADMIN')
 *   requireRole('ADMIN', 'HOSPITAL')
 *
 *   no session   -> 401
 *   wrong role   -> 403
 *   allowed role -> next()
 */

const { assertRole } = require('../security/authorization');
const { ROLE_VALUES } = require('../core/constants');

function requireRole(...roles) {
  if (roles.length === 0) {
    throw new Error('requireRole() needs at least one role');
  }
  const unknown = roles.filter((r) => !ROLE_VALUES.includes(r));
  if (unknown.length > 0) {
    throw new Error(`requireRole() received unknown role(s): ${unknown.join(', ')}`);
  }

  return function roleGuard(req, res, next) {
    try {
      req.user = assertRole(req, roles);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireRole };
