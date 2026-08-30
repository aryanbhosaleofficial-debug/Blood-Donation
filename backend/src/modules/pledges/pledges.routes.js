'use strict';

const router = require('express').Router();
const { requireRole } = require('../../middleware/require-role');
const { requireActive } = require('../../middleware/require-active');
const { validate } = require('../../middleware/validate');
const { ROLES } = require('../../core/constants');
const schemas = require('./pledges.schemas');
const controller = require('./pledges.controller');
const locationRoutes = require('../locations/locations.routes');

router.use(requireRole(ROLES.DONOR), requireActive);
router.get('/', controller.list);
router.use('/:pledgeId/location', locationRoutes);
router.get('/:pledgeId', validate(schemas.pledgeIdParamSchema, 'params'), controller.detail);
const capture = (req, res, next) => { req.pledgeId = req.validated.pledgeId; next(); };
router.post('/:pledgeId/cancel', validate(schemas.pledgeIdParamSchema, 'params'), capture, validate(schemas.emptyBodySchema), controller.cancel);
router.post('/:pledgeId/arrive', validate(schemas.pledgeIdParamSchema, 'params'), capture, validate(schemas.emptyBodySchema), controller.arrive);

module.exports = router;
