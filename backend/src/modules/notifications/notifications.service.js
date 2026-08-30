'use strict';

/**
 * modules/notifications/notifications.service
 *
 * Application-layer service for user-facing notification operations.
 * All writes (mark read) require session authentication; recipient IDs
 * are derived from the session, never from request bodies.
 */

const repo = require('./notifications.repository');
const serializer = require('./notifications.serializer');
const policy = require('./notifications.policy');
const { listQuerySchema } = require('./notifications.schemas');
const { ValidationError } = require('../../core/errors');

function list(user, rawQuery = {}) {
  const parsed = listQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new ValidationError('Invalid query parameters.', { code: 'VALIDATION_ERROR' });
  const q = parsed.data;
  const rows = repo.list(user.id, {
    limit: q.limit,
    offset: q.offset,
    unreadOnly: q.unread === 'true',
    eventType: q.eventType ?? null,
  });
  return {
    notifications: serializer.serializeList(rows),
    pagination: { limit: q.limit, offset: q.offset, count: rows.length },
  };
}

function unreadCount(user) {
  return { count: repo.countUnread(user.id) };
}

function getOne(user, notificationId) {
  const id = parseInt(notificationId, 10);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid notification id.', { code: 'VALIDATION_ERROR' });
  const row = repo.findOwned(id, user.id);
  policy.assertOwned(row, user.id);
  return { notification: serializer.serialize(row) };
}

function markRead(user, notificationId) {
  const id = parseInt(notificationId, 10);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid notification id.', { code: 'VALIDATION_ERROR' });
  const row = repo.findOwned(id, user.id);
  policy.assertOwned(row, user.id);
  repo.markRead(id, user.id);
  const updated = repo.findOwned(id, user.id);
  return { notification: serializer.serialize(updated) };
}

/** Admin: list FAILED notifications (safe fields only). */
function listFailed() {
  return { notifications: repo.listFailed(100).map(serializer.adminView) };
}

/** Admin: requeue a FAILED notification. */
function requeueFailed(notificationId) {
  const id = parseInt(notificationId, 10);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid notification id.', { code: 'VALIDATION_ERROR' });
  const result = repo.requeueFailed(id);
  if (!result || result.changes === 0) {
    const { NotFoundError } = require('../../core/errors');
    throw new NotFoundError('Notification not found or not in FAILED state.', { code: 'NOTIFICATION_NOT_FOUND' });
  }
  return { requeued: true };
}

module.exports = { list, unreadCount, getOne, markRead, listFailed, requeueFailed };
