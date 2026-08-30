'use strict';

/**
 * modules/surge/surge.routes  —  mounted at /api/admin/surge
 *
 * ADMIN-only. There is deliberately NO public surge API: normal
 * DONOR / HOSPITAL / BLOOD_BANK users never see raw anomaly scores.
 * GET routes are read-only; confirm/reject are CSRF- + Origin-protected
 * mutations (handled by the global security middleware).
 */

const { Router } = require('express');
const { requireRole } = require('../../middleware/require-role');
const { validate } = require('../../middleware/validate');
const { ROLES } = require('../../core/constants');
const c = require('./surge.controller');
const s = require('./surge.schemas');

const router = Router();

router.use(requireRole(ROLES.ADMIN));

router.get('/candidates', validate(s.candidateListQuerySchema, 'query'), c.listCandidates);
router.get('/candidates/:candidateId', validate(s.candidateIdParamSchema, 'params'), c.getCandidate);
router.post('/candidates/:candidateId/confirm', validate(s.candidateIdParamSchema, 'params'), c.confirmCandidate);
router.post('/candidates/:candidateId/reject', validate(s.candidateIdParamSchema, 'params'), c.rejectCandidate);
router.get('/events', validate(s.eventListQuerySchema, 'query'), c.listEvents);
router.get('/events/:eventId', validate(s.eventIdParamSchema, 'params'), c.getEvent);

module.exports = router;
