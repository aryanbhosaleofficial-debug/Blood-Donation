'use strict';

/**
 * modules/auth/auth.controller
 *
 * Thin HTTP layer: read validated input, call the service, shape the response.
 */

const { sendSuccess } = require('../../core/response');
const { SESSION_COOKIE_NAME } = require('../../core/constants');
const csrf = require('../../security/csrf');
const usersService = require('../users/users.service');
const authService = require('./auth.service');

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const userRow = await authService.authenticate(req.validated);

    // 01.07 session fixation: never keep the pre-login session id.
    await regenerateSession(req);
    req.session.user = usersService.toSessionUser(userRow);
    // Bind a fresh CSRF token to the new authenticated session.
    csrf.rotateToken(req);
    await saveSession(req);

    return sendSuccess(res, { user: usersService.toPublicUser(userRow) });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/logout  (requires auth + CSRF) */
function logout(req, res, next) {
  req.session.destroy((err) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax' });
    if (err) {
      return next(err);
    }
    return sendSuccess(res, { loggedOut: true });
  });
}

/** GET /api/auth/me  (requires auth) */
function me(req, res, next) {
  try {
    const current = usersService.findById(req.session.user.id);
    if (!current || !usersService.isActive(current)) {
      req.session.destroy(() => {});
      const { ForbiddenError } = require('../../core/errors');
      throw new ForbiddenError('This account is inactive.', { code: 'ACCOUNT_INACTIVE' });
    }
    req.session.user = usersService.toSessionUser(current);
    return sendSuccess(res, { user: usersService.toPublicUser(current) });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/auth/csrf-token  (requires auth) */
async function csrfToken(req, res, next) {
  try {
    const token = csrf.getOrCreateToken(req);
    await saveSession(req);
    return sendSuccess(res, { csrfToken: token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, logout, me, csrfToken };
