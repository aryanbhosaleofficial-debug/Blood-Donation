'use strict';

/**
 * middleware/error-handler
 *
 * Single Express error-handling middleware. Normalizes body-parser errors,
 * then defers to core/response.sendError which enforces the standard shape and
 * hides internal details / stack traces from clients.
 */

const { sendError } = require('../core/response');
const { AppError, ValidationError } = require('../core/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let normalized = err;

  if (err && err.type === 'entity.too.large') {
    normalized = new AppError('Request body is too large.', {
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    });
  } else if (
    (err && err.type === 'entity.parse.failed') ||
    (err instanceof SyntaxError && 'body' in err)
  ) {
    normalized = new ValidationError('Request body is not valid JSON.');
  }

  return sendError(res, normalized);
}

module.exports = { errorHandler };
