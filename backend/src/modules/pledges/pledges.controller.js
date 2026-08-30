'use strict';

const { sendSuccess } = require('../../core/response');
const service = require('./pledges.service');

function create(req, res, next) {
  try { return sendSuccess(res, service.create(req.user, req.alertId), 201); }
  catch (err) { return next(err); }
}
function list(req, res, next) {
  try { return sendSuccess(res, service.listForDonor(req.user)); }
  catch (err) { return next(err); }
}
function detail(req, res, next) {
  try { return sendSuccess(res, service.getForDonor(req.user, req.validated.pledgeId)); }
  catch (err) { return next(err); }
}
function action(method) {
  return (req, res, next) => {
    try { return sendSuccess(res, service[method](req.user, req.pledgeId)); }
    catch (err) { return next(err); }
  };
}
function hospitalList(req, res, next) {
  try { return sendSuccess(res, service.listForHospital(req.user, req.validated.requestId)); }
  catch (err) { return next(err); }
}

module.exports = { create, list, detail, cancel: action('cancel'), arrive: action('arrive'), hospitalList };
