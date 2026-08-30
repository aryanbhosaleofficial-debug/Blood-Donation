'use strict';

/**
 * modules/audit/audit.controller
 *
 * GET /api/admin/audit-logs  — read-only, ADMIN only
 */

const { sendSuccess } = require('../../core/response');
const auditService = require('./audit.service');
const { auditQuerySchema } = require('./audit.schemas');
const { serializePage } = require('./audit.serializer');
const { ValidationError } = require('../../core/errors');

async function list(req, res, next) {
  try {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid audit log filter parameters.', {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { action, entityType, entityId, actorUserId, from, to, limit, offset } = parsed.data;
    const { rows, total } = auditService.queryAuditLogs({
      action,
      entityType,
      entityId,
      actorUserId,
      from,
      to,
      limit,
      offset,
    });

    sendSuccess(res, serializePage(rows, total, limit, offset));
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
