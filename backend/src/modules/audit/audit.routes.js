'use strict';

/**
 * modules/audit/audit.routes
 *
 * Admin-only audit log API.
 * Read-only — no mutation endpoints.
 */

const { Router } = require('express');
const { requireRole } = require('../../middleware/require-role');
const { ROLES } = require('../../core/constants');
const controller = require('./audit.controller');

const router = Router();

// All audit routes require ADMIN role.
router.use(requireRole(ROLES.ADMIN));

// GET /api/admin/audit-logs
router.get('/', controller.list);

module.exports = router;
