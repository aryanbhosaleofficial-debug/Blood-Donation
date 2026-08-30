'use strict';

/**
 * core/errors
 *
 * Application error classes and helpers that map them to HTTP responses.
 *
 * Error response shape (every failure, everywhere):
 *   { "error": { "code": "SOME_CODE", "message": "human readable message" } }
 */

class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number, details?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'INTERNAL_ERROR';
    this.status = options.status || 500;
    this.details = options.details;
    // Only 4xx errors are safe to echo back to the client verbatim.
    this.expose = this.status >= 400 && this.status < 500;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'The request was invalid.', options = {}) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, ...options });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.', options = {}) {
    super(message, { code: 'UNAUTHORIZED', status: 401, ...options });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.', options = {}) {
    super(message, { code: 'FORBIDDEN', status: 403, ...options });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found.', options = {}) {
    super(message, { code: 'NOT_FOUND', status: 404, ...options });
  }
}

class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.', options = {}) {
    super(message, { code: 'CONFLICT', status: 409, ...options });
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please try again later.', options = {}) {
    super(message, { code: 'TOO_MANY_REQUESTS', status: 429, ...options });
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'A required dependency is unavailable.', options = {}) {
    super(message, { code: 'SERVICE_UNAVAILABLE', status: 503, ...options });
  }
}

/**
 * Map any thrown value to the HTTP status code that should be sent.
 * @param {unknown} err
 * @returns {number}
 */
function httpStatusFor(err) {
  if (err instanceof AppError) {
    return err.status;
  }
  return 500;
}

/**
 * Build the standard error response body for any thrown value.
 * Non-AppError values (and 5xx AppErrors) are collapsed to a generic message
 * so internal details never leak to the client.
 * @param {unknown} err
 * @returns {{ error: { code: string, message: string } }}
 */
function toErrorBody(err) {
  if (err instanceof AppError && err.expose) {
    return { error: { code: err.code, message: err.message } };
  }
  return { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } };
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ServiceUnavailableError,
  httpStatusFor,
  toErrorBody,
};
