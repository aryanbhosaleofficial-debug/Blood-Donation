'use strict';

/**
 * modules/notifications/notifications.schemas
 *
 * Zod validation schemas for notification query parameters.
 * Users supply only safe filter values; recipient IDs are never accepted
 * from query strings.
 */

const { z } = require('zod');

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  unread: z.enum(['true', 'false']).optional(),
  eventType: z.string().max(64).optional(),
}).strict();

module.exports = { listQuerySchema };
