'use strict';

/**
 * modules/auth/auth.routes
 *
 * Mounted at /api/auth by app.js.
 *
 * CSRF note (01.20): POST /login is exempt from the authenticated CSRF-token
 * check (there is no session yet) but still passes Origin validation + login
 * rate limiting + input validation. Every other state-changing route,
 * including logout, requires the CSRF token.
 */

const express = require('express');

const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/authenticate');
const { loginRateLimiter } = require('../../security/rate-limit');
const { loginSchema } = require('./auth.schemas');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/login', loginRateLimiter, validate(loginSchema), controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.get('/csrf-token', requireAuth, controller.csrfToken);

module.exports = router;
