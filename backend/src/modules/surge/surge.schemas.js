'use strict';

/**
 * modules/surge/surge.schemas
 *
 * Zod validation for the ADMIN surge API. No arbitrary SQL filters are exposed.
 */

const { z } = require('zod');
const { BLOOD_GROUPS } = require('../../core/constants');
const { CANDIDATE_STATUS, EVENT_STATUS } = require('./surge.constants');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const candidateListQuerySchema = z.object({
  status: z.enum(Object.values(CANDIDATE_STATUS)).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  isSynthetic: z.enum(['true', 'false']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const eventListQuerySchema = z.object({
  status: z.enum(Object.values(EVENT_STATUS)).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const candidateIdParamSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
});

const eventIdParamSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});

const reviewBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

module.exports = {
  candidateListQuerySchema,
  eventListQuerySchema,
  candidateIdParamSchema,
  eventIdParamSchema,
  reviewBodySchema,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
