'use strict';

/**
 * modules/requests/requests.routes  ->  mounted at /api/requests
 *
 *   POST   /api/requests                  HOSPITAL + verified
 *   GET    /api/requests                  HOSPITAL (own) | ADMIN (all, read-only)
 *   GET    /api/requests/:requestId       HOSPITAL owner | ADMIN
 *   POST   /api/requests/:requestId/cancel   HOSPITAL owner + verified
 *   POST   /api/requests/:requestId/complete HOSPITAL owner + verified
 *
 * CSRF + Origin validation are applied globally in app.js for the POST routes.
 */

const router = require('express').Router();

const { requireRole } = require('../../middleware/require-role');
const { requireVerified } = require('../../middleware/require-verified');
const { validate } = require('../../middleware/validate');
const { ROLES } = require('../../core/constants');
const schemas = require('./requests.schemas');
const c = require('./requests.controller');
const allocationsController = require('../allocations/allocations.controller');
const allocationSchemas = require('../allocations/allocations.schemas');

router.post(
  '/',
  requireRole(ROLES.HOSPITAL),
  requireVerified,
  validate(schemas.createRequestSchema),
  c.create,
);

router.get(
  '/',
  requireRole(ROLES.HOSPITAL, ROLES.ADMIN),
  validate(schemas.listRequestsQuerySchema, 'query'),
  c.list,
);

router.get(
  '/:requestId/allocations',
  requireRole(ROLES.HOSPITAL),
  validate(allocationSchemas.requestIdParamSchema, 'params'),
  allocationsController.hospitalList,
);

router.post(
  '/:requestId/allocate',
  requireRole(ROLES.BLOOD_BANK),
  requireVerified,
  validate(allocationSchemas.requestIdParamSchema, 'params'),
  (req, res, next) => { req.requestId = req.validated.requestId; next(); },
  validate(allocationSchemas.emptyBodySchema),
  allocationsController.allocate,
);

router.get(
  '/:requestId',
  requireRole(ROLES.HOSPITAL, ROLES.ADMIN),
  validate(schemas.requestIdParamSchema, 'params'),
  c.getOne,
);

router.post(
  '/:requestId/cancel',
  requireRole(ROLES.HOSPITAL),
  requireVerified,
  validate(schemas.requestIdParamSchema, 'params'),
  c.cancel,
);

router.post(
  '/:requestId/complete',
  requireRole(ROLES.HOSPITAL),
  requireVerified,
  validate(schemas.requestIdParamSchema, 'params'),
  c.complete,
);

module.exports = router;
