'use strict';

/**
 * core/response
 *
 * Helpers so every controller emits the same JSON envelope.
 *
 *   success:  { "data": <payload> }
 *   error:    { "error": { "code": "...", "message": "..." } }
 */

const logger = require('./logger');
const { httpStatusFor, toErrorBody, NotFoundError } = require('./errors');

/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {number} [status=200]
 */
function sendSuccess(res, data = null, status = 200) {
  return res.status(status).json({ data });
}

/**
 * @param {import('express').Response} res
 * @param {unknown} err
 */
function isExpectedUnauthenticatedProbe(res, err, status) {
  const req = res && res.req;
  if (!req || status !== 401 || !err || err.code !== 'UNAUTHORIZED') return false;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return req.method === 'GET' && path === '/api/auth/me';
}

function sendError(res, err) {
  const status = httpStatusFor(err);
  if (status >= 500) {
    logger.error('request failed', { code: err && err.code, message: err && err.message, stack: err && err.stack });
  } else if (isExpectedUnauthenticatedProbe(res, err, status)) {
    logger.info('unauthenticated auth bootstrap', {
      code: err.code,
      method: res.req.method,
      path: String(res.req.originalUrl || res.req.url || '').split('?')[0],
    });
  } else {
    logger.warn('request rejected', { code: err && err.code, message: err && err.message });
  }
  return res.status(status).json(toErrorBody(err));
}

/** Express 404 handler for unmatched routes. */
function notFoundHandler(req, res) {
  sendError(res, new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

/** Express error-handling middleware (must keep the 4-arg signature). */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  sendError(res, err);
}

module.exports = { sendSuccess, sendError, notFoundHandler, errorHandler, isExpectedUnauthenticatedProbe };
