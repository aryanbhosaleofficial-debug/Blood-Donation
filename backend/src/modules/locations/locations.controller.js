'use strict';

const { sendSuccess } = require('../../core/response');
const service = require('./locations.service');

function update(req, res, next) {
  try { return sendSuccess(res, service.update(req.user.id, req.pledgeId, req.validated)); }
  catch (err) { return next(err); }
}

function stop(req, res, next) {
  try { return sendSuccess(res, service.stop(req.user.id, req.validated.pledgeId)); }
  catch (err) { return next(err); }
}

module.exports = { update, stop };
