'use strict';

/**
 * modules/notifications/notifications.routes
 *
 * User-facing notification REST routes. All require authentication.
 * Recipient IDs come from the session, never from request bodies.
 *
 * GET routes are strictly read-only (no side effects).
 * POST /read requires CSRF + Origin validation (enforced globally).
 *
 * Mounted at /api/notifications by app.js
 */

const express = require('express');
const { requireAuth } = require('../../middleware/authenticate');
const { requireRole } = require('../../middleware/require-role');
const controller = require('./notifications.controller');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, controller.list);

// GET /api/notifications/unread-count
// Must be before /:notificationId to avoid param collision
router.get('/unread-count', requireAuth, controller.unreadCount);

// GET /api/notifications/:notificationId
router.get('/:notificationId', requireAuth, controller.getOne);

// POST /api/notifications/:notificationId/read
router.post('/:notificationId/read', requireAuth, controller.markRead);

// Admin: GET /api/notifications/admin/failed
// Note: mounted separately via admin route in app.js as /api/admin/notifications/failed
router.get('/admin/failed', requireRole('ADMIN'), controller.listFailed);
router.post('/admin/:notificationId/retry', requireRole('ADMIN'), controller.requeueFailed);

module.exports = router;
