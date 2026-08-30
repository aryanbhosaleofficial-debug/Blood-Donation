'use strict';

/**
 * modules/surge/surge.controller
 *
 * Thin HTTP layer for the ADMIN-only surge API. All validation is done by the
 * `validate` middleware; the admin actor always comes from the session.
 */

const { sendSuccess } = require('../../core/response');
const { ValidationError } = require('../../core/errors');
const service = require('./surge.service');
const { reviewBodySchema } = require('./surge.schemas');

function parseNote(req) {
  const parsed = reviewBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ValidationError('The submitted data is invalid.', {
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return parsed.data.note;
}

function listCandidates(req, res, next) {
  try {
    return sendSuccess(res, service.listCandidates(req.validated));
  } catch (err) {
    return next(err);
  }
}

function getCandidate(req, res, next) {
  try {
    return sendSuccess(res, service.getCandidate(req.validated.candidateId));
  } catch (err) {
    return next(err);
  }
}

function confirmCandidate(req, res, next) {
  try {
    const note = parseNote(req);
    return sendSuccess(res, service.confirmCandidate(req.user.id, req.validated.candidateId, note));
  } catch (err) {
    return next(err);
  }
}

function rejectCandidate(req, res, next) {
  try {
    const note = parseNote(req);
    return sendSuccess(res, service.rejectCandidate(req.user.id, req.validated.candidateId, note));
  } catch (err) {
    return next(err);
  }
}

function listEvents(req, res, next) {
  try {
    return sendSuccess(res, service.listEvents(req.validated));
  } catch (err) {
    return next(err);
  }
}

function getEvent(req, res, next) {
  try {
    return sendSuccess(res, service.getEvent(req.validated.eventId));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCandidates,
  getCandidate,
  confirmCandidate,
  rejectCandidate,
  listEvents,
  getEvent,
};
