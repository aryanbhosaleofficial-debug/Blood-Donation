'use strict';

/**
 * modules/metrics/metrics.controller
 *
 * GET /api/admin/metrics  — ADMIN only, read-only
 */

const { sendSuccess } = require('../../core/response');
const { gatherMetrics } = require('./metrics.service');

async function get(req, res, next) {
  try {
    const metrics = gatherMetrics();
    sendSuccess(res, { metrics });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
