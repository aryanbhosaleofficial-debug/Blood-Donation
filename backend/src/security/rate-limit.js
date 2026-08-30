'use strict';

/**
 * security/rate-limit
 *
 * IP-based rate limiting for the login endpoint only.
 *
 * This is a coarse anti-automation control. The primary brute-force defence is
 * the per-account lockout (see users.service). The IP limit is deliberately
 * generous because many demo users can share one campus/public IP.
 */

const { rateLimit } = require('express-rate-limit');

const config = require('../core/config');
const logger = require('../core/logger');
const { sendError } = require('../core/response');
const { TooManyRequestsError } = require('../core/errors');

const loginRateLimiter = rateLimit({
  windowMs: config.login.rateLimitWindowMinutes * 60 * 1000,
  limit: config.login.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // We terminate directly instead of connecting to a proxy header we don't trust.
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('login rate limit hit', { ip: req.ip });
    sendError(
      res,
      new TooManyRequestsError('Too many login attempts from this network. Please wait and try again.'),
    );
  },
});

module.exports = { loginRateLimiter };
