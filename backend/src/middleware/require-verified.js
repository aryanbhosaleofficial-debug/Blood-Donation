'use strict';

const { UnauthorizedError, ForbiddenError } = require('../core/errors');
const usersService = require('../modules/users/users.service');

function requireVerified(req, res, next) {
  try {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser) throw new UnauthorizedError();
    const current = usersService.findById(sessionUser.id);
    if (!current || !usersService.isActive(current)) {
      req.session.destroy(() => {});
      throw new ForbiddenError('This account is inactive.', { code: 'ACCOUNT_INACTIVE' });
    }
    if (!usersService.toPublicUser(current).isVerified) {
      throw new ForbiddenError('Organization verification is required.', { code: 'ORGANIZATION_NOT_VERIFIED' });
    }
    req.user = usersService.toSessionUser(current);
    req.session.user = req.user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireVerified };
