'use strict';

/**
 * modules/audit/audit.schemas
 *
 * Zod validation schemas for audit admin API query parameters.
 */

const { z } = require('zod');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('./audit.constants');

const MAX_AUDIT_LIMIT = 200;
const DEFAULT_AUDIT_LIMIT = 50;

const auditQuerySchema = z.object({
  action: z.enum(Object.values(AUDIT_ACTION)).optional(),
  entityType: z.enum(Object.values(AUDIT_ENTITY)).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_AUDIT_LIMIT).default(DEFAULT_AUDIT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = { auditQuerySchema, MAX_AUDIT_LIMIT, DEFAULT_AUDIT_LIMIT };
