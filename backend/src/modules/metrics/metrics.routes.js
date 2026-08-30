'use strict';

/**
 * modules/metrics/metrics.routes
 *
 * Admin-only operational metrics API.
 */

const { Router } = require('express');
const { requireRole } = require('../../middleware/require-role');
const { ROLES } = require('../../core/constants');
const controller = require('./metrics.controller');

const router = Router();

router.use(requireRole(ROLES.ADMIN));

// GET /api/admin/metrics
router.get('/', controller.get);

module.exports = router;
