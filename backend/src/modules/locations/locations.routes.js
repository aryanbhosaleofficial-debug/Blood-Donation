'use strict';

const router = require('express').Router({ mergeParams: true });
const { validate } = require('../../middleware/validate');
const schemas = require('./locations.schemas');
const controller = require('./locations.controller');

router.post(
  '/',
  validate(schemas.pledgeIdParamSchema, 'params'),
  (req, res, next) => { req.pledgeId = req.validated.pledgeId; next(); },
  validate(schemas.locationSchema),
  controller.update,
);
router.delete('/', validate(schemas.pledgeIdParamSchema, 'params'), controller.stop);

module.exports = router;
