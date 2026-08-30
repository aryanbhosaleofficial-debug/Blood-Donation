'use strict';

/**
 * security/csrf
 *
 * Synchronizer-token CSRF protection + Origin validation, implemented directly
 * (no `csurf`).
 *
 * Model:
 *   - a random token is generated with crypto.randomBytes and stored in the
 *     server-side session (req.session.csrfToken)
 *   - state-changing requests (POST/PUT/PATCH/DELETE) must:
 *       1. carry an Origin (or Referer) matching APP_ORIGIN
 *       2. send the token in the `X-CSRF-Token` header
 *       3. the header token must match the session token (timing-safe compare)
 *   - safe methods (GET/HEAD/OPTIONS) are never checked
 *   - `exemptPaths` (e.g. POST /api/auth/login) skip the token check but STILL
 *     get Origin validation
 */

const crypto = require('node:crypto');

const config = require('../core/config');
const { ForbiddenError } = require('../core/errors');
const { CSRF_HEADER_NAME, SAFE_HTTP_METHODS } = require('../core/constants');

const SAFE_METHODS = new Set(SAFE_HTTP_METHODS);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Return the session's CSRF token, creating one on first access. */
function getOrCreateToken(req) {
  if (!req.session) {
    throw new Error('csrf.getOrCreateToken requires an active session');
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }
  return req.session.csrfToken;
}

/** Force a new token (used after login so the value is bound to the new session). */
function rotateToken(req) {
  if (!req.session) {
    throw new Error('csrf.rotateToken requires an active session');
  }
  req.session.csrfToken = generateToken();
  return req.session.csrfToken;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Is the request's Origin (or Referer fallback) the configured app or frontend origin? */
function isAllowedOrigin(req) {
  const allowed = new Set([config.appOrigin, config.frontendOrigin].filter(Boolean));
  const origin = req.get('origin');
  if (origin) {
    return allowed.has(origin);
  }
  const referer = req.get('referer');
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  // No Origin and no Referer on a state-changing request: reject (safer default).
  return false;
}

/**
 * Build the CSRF middleware.
 * @param {{ exemptPaths?: string[] }} [options]
 */
function createCsrfMiddleware({ exemptPaths = [] } = {}) {
  const exempt = new Set(exemptPaths);

  return function csrfMiddleware(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    if (!isAllowedOrigin(req)) {
      return next(new ForbiddenError('Request origin is not allowed.', { code: 'INVALID_ORIGIN' }));
    }

    if (exempt.has(req.path)) {
      return next();
    }

    const sessionToken = req.session && req.session.csrfToken;
    const providedToken = req.get(CSRF_HEADER_NAME);

    if (!sessionToken || !providedToken || !timingSafeEqual(sessionToken, providedToken)) {
      return next(new ForbiddenError('Invalid or missing CSRF token.', { code: 'INVALID_CSRF_TOKEN' }));
    }

    return next();
  };
}

module.exports = {
  generateToken,
  getOrCreateToken,
  rotateToken,
  isAllowedOrigin,
  timingSafeEqual,
  createCsrfMiddleware,
};
