'use strict';

/**
 * middleware/validate
 *
 * One reusable Zod validation pattern so controllers never call
 * `schema.safeParse` themselves.
 *
 *   router.post('/login', validate(loginSchema), controller.login)
 *   // -> controller reads req.validated
 *
 * `source` selects which part of the request to validate ('body' | 'query' |
 * 'params'); the parsed/coerced result is placed on `req.validated`.
 */

const { ValidationError } = require('../core/errors');

function validate(schema, source = 'body') {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new Error('validate() requires a Zod schema');
  }

  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('The submitted data is invalid.', { details }));
    }
    req.validated = result.data;
    return next();
  };
}

module.exports = { validate };
