'use strict';

/**
 * middleware/not-found
 *
 * Final handler for any route that did not match. Produces the standard JSON
 * error shape (never a default Express HTML page).
 */

const { NotFoundError } = require('../core/errors');

function notFound(req, res, next) {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`, { code: 'NOT_FOUND' }));
}

module.exports = { notFound };
