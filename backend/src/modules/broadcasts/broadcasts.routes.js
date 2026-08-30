'use strict';

/**
 * modules/broadcasts/broadcasts.routes  ->  mounted at /api/blood-bank/requests
 *
 *   GET /api/blood-bank/requests               OPEN requests broadcast to this bank
 *   GET /api/blood-bank/requests/:requestId    one such request (broadcast row required)
 *
 * Read-only. Module 03 exposes no reserve / allocate actions.
 */

const router = require('express').Router();

const { requireRole } = require('../../middleware/require-role');
const { requireVerified } = require('../../middleware/require-verified');
const { validate } = require('../../middleware/validate');
const { ROLES } = require('../../core/constants');
const { requestIdParamSchema } = require('../requests/requests.schemas');
const c = require('./broadcasts.controller');

router.use(requireRole(ROLES.BLOOD_BANK), requireVerified);

router.get('/', c.listIncoming);
router.get('/:requestId', validate(requestIdParamSchema, 'params'), c.getIncoming);

module.exports = router;
