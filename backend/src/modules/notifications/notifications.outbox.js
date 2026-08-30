'use strict';

/**
 * modules/notifications/notifications.outbox
 *
 * Internal helper that inserts a QUEUED notification inside an existing
 * transaction context. This is NOT an HTTP API endpoint.
 *
 * Rules:
 *   - Must be called with an active transaction db handle.
 *   - The provider must NEVER be called from here.
 *   - Deduplication is handled by the UNIQUE constraint: a duplicate
 *     dedupe_key silently returns null (no row, no error).
 *   - If the notification is part of the domain transaction contract,
 *     the caller should NOT catch the error (roll back if insert fails).
 */

const config = require('../../core/config');
const repo = require('./notifications.repository');
const { NOTIFICATION_CHANNEL } = require('./notifications.constants');

/**
 * Queue a notification inside an existing transaction.
 *
 * @param {import('better-sqlite3').Database} db - active transaction handle
 * @param {object} opts
 * @param {number} opts.recipientUserId
 * @param {string} opts.channel - NOTIFICATION_CHANNEL value
 * @param {string} opts.eventType - NOTIFICATION_EVENT value
 * @param {string|null} [opts.entityType] - NOTIFICATION_ENTITY value
 * @param {number|null} [opts.entityId]
 * @param {string} opts.dedupeKey - unique logical event key
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {object} [opts.payload] - safe, minimal structured data
 * @returns {object|null} inserted row, or null if deduplicated
 */
function queueNotification(db, {
  recipientUserId,
  channel = NOTIFICATION_CHANNEL.IN_APP,
  eventType,
  entityType = null,
  entityId = null,
  dedupeKey,
  title,
  message,
  payload = {},
}) {
  return repo.insertQueued(db, {
    recipientUserId,
    channel,
    eventType,
    entityType,
    entityId,
    dedupeKey,
    title,
    message,
    payload,
    maxAttempts: config.notificationMaxAttempts,
  });
}

module.exports = { queueNotification };
