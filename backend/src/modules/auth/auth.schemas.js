'use strict';

/**
 * modules/auth/auth.schemas
 *
 * Zod schemas for auth endpoints. Email is normalized (trim + lowercase) as
 * part of parsing. The login password bounds mirror the password policy
 * (12..72) so malformed input is a 400, while a well-formed but wrong password
 * is a generic 401.
 */

const { z } = require('zod');

const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_BYTES } = require('../../security/password');

const emailField = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(3, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.');

const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: 'Password is required.' })
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
    .max(PASSWORD_MAX_BYTES, `Password must be at most ${PASSWORD_MAX_BYTES} characters long.`),
});

module.exports = { loginSchema, emailField };
