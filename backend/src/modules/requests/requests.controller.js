'use strict';

/**
 * modules/requests/requests.controller
 *
 * Thin HTTP layer: read validated input + session user, call the service,
 * shape the envelope.
 */

const { sendSuccess } = require('../../core/response');
const { ROLES } = require('../../core/constants');
const service = require('./requests.service');

function create(req, res, next) {
  try {
    const result = service.create(req.user, req.validated);
    // 201 for a fresh request; 200 when an idempotent replay returns the existing one.
    return sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  } catch (err) {
    return next(err);
  }
}

function list(req, res, next) {
  try {
    const status = req.validated ? req.validated.status : undefined;
    const data =
      req.user.role === ROLES.ADMIN
        ? service.listForAdmin(status)
        : service.listForHospital(req.user, status);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

function getOne(req, res, next) {
  try {
    return sendSuccess(res, service.getOne(req.user, req.validated.requestId));
  } catch (err) {
    return next(err);
  }
}

function cancel(req, res, next) {
  try {
    return sendSuccess(res, service.cancel(req.user, req.validated.requestId));
  } catch (err) {
    return next(err);
  }
}

function complete(req, res, next) {
  try {
    return sendSuccess(res, service.complete(req.user, req.validated.requestId));
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getOne, cancel, complete };
