'use strict';

/**
 * modules/broadcasts/broadcasts.controller
 *
 * Blood-bank incoming-request views. Read-only.
 */

const { sendSuccess } = require('../../core/response');
const service = require('./broadcasts.service');

function listIncoming(req, res, next) {
  try {
    return sendSuccess(res, service.listIncomingForBank(req.user));
  } catch (err) {
    return next(err);
  }
}

function getIncoming(req, res, next) {
  try {
    return sendSuccess(res, service.getIncomingForBank(req.user, req.validated.requestId));
  } catch (err) {
    return next(err);
  }
}

module.exports = { listIncoming, getIncoming };
