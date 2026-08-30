'use strict';

/**
 * modules/requests/requests.schemas
 *
 * Zod input validation for the request endpoints.
 *
 * - strict object: unexpected/protected fields (hospitalId, status, isSynthetic,
 *   scenarioId, createdAt, expiresAt, ...) are rejected with VALIDATION_ERROR.
 * - component is the literal RED_CELLS only (MVP scope).
 * - unitsNeeded must be a whole integer within [1, REQUEST_MAX_UNITS].
 */

const { z } = require('zod');

const config = require('../../core/config');
const { BLOOD_GROUPS, COMPONENTS, REQUEST_URGENCY_VALUES } = require('../../core/constants');

const NOTE_MAX_LENGTH = 500;

const createRequestSchema = z.strictObject({
  clientRequestId: z.uuid('clientRequestId must be a valid UUID.'),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'Unsupported blood group.' }),
  component: z.literal(COMPONENTS.RED_CELLS, { error: 'Only RED_CELLS is supported.' }),
  unitsNeeded: z
    .number({ error: 'unitsNeeded must be a number.' })
    .int('unitsNeeded must be a whole number.')
    .min(1, 'unitsNeeded must be at least 1.')
    .max(config.requestMaxUnits, `unitsNeeded must not exceed ${config.requestMaxUnits}.`),
  urgency: z.enum(REQUEST_URGENCY_VALUES, { error: 'Invalid urgency.' }),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH, `note must be at most ${NOTE_MAX_LENGTH} characters.`)
    .optional(),
});

// :requestId path param -> positive integer.
const requestIdParamSchema = z.strictObject({
  requestId: z.coerce.number().int().positive('requestId must be a positive integer.'),
});

// Optional ?status= filter on the list endpoint.
const listRequestsQuerySchema = z.strictObject({
  status: z.enum(['OPEN', 'COVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
});

module.exports = {
  createRequestSchema,
  requestIdParamSchema,
  listRequestsQuerySchema,
  NOTE_MAX_LENGTH,
};
