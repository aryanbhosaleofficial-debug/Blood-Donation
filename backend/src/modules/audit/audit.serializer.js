'use strict';

/**
 * modules/audit/audit.serializer
 *
 * Shapes audit_logs rows for the admin REST API response.
 * Never returns password hashes, session data, or raw secrets.
 */

/**
 * Safe public view of a single audit log row.
 * metadata_json is parsed and returned as an object.
 *
 * @param {object} row  — raw database row
 * @returns {object}
 */
function serialize(row) {
  let metadata = {};
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
  } catch {
    metadata = { _parseError: true };
  }

  return {
    id: row.id,
    actorUserId: row.actor_user_id ?? null,
    action: row.action,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    metadata,
    createdAt: row.created_at,
  };
}

/**
 * Serialise a page of audit log rows.
 *
 * @param {object[]} rows
 * @param {number}   total
 * @param {number}   limit
 * @param {number}   offset
 * @returns {object}
 */
function serializePage(rows, total, limit, offset) {
  return {
    auditLogs: rows.map(serialize),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
    },
  };
}

module.exports = { serialize, serializePage };
