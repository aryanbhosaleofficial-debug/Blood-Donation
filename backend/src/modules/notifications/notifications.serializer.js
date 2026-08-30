'use strict';

/**
 * modules/notifications/notifications.serializer
 *
 * Converts raw notification DB rows into safe public representations.
 * Never exposes: dedupe_key, last_error, provider internals.
 */

function serialize(row) {
  if (!row) return null;
  let payload = {};
  try { payload = JSON.parse(row.payload_json || '{}'); } catch { /* ignore */ }
  return {
    id: row.id,
    eventType: row.event_type,
    channel: row.channel,
    title: row.title,
    message: row.message,
    entity: row.entity_type ? { type: row.entity_type, id: row.entity_id ?? null } : null,
    payload,
    status: row.status,
    isRead: row.read_at != null,
    createdAt: row.created_at,
    queuedAt: row.queued_at,
    sentAt: row.sent_at ?? null,
    readAt: row.read_at ?? null,
  };
}

function serializeList(rows) {
  return rows.map(serialize);
}

/** Admin-only view: includes safe error info, no payload. */
function adminView(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    channel: row.channel,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    lastError: row.last_error ?? null,
    failedAt: row.failed_at ?? null,
    createdAt: row.created_at,
  };
}

module.exports = { serialize, serializeList, adminView };
