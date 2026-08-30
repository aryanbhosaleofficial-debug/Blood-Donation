'use strict';

/**
 * middleware/authenticate
 *
 * requireAuth: allow the request through only when there is an authenticated
 * session. Attaches the session user to req.user for convenience.
 */

const { assertAuthenticated } = require('../security/authorization');

function requireAuth(req, res, next) {
  try {
    req.user = assertAuthenticated(req);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
