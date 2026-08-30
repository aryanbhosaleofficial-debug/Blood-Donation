'use strict';

const { getDb } = require('../../core/database');

function insertQueued(db, { recipientUserId, channel, eventType, entityType, entityId, dedupeKey, title, message, payload, maxAttempts }) {
  try {
    const info = db.prepare(`
      INSERT INTO notifications
        (recipient_user_id, channel, event_type, entity_type, entity_id,
         dedupe_key, title, message, payload_json, status,
         attempt_count, max_attempts, queued_at)
      VALUES
        (@recipientUserId, @channel, @eventType, @entityType, @entityId,
         @dedupeKey, @title, @message, @payloadJson, 'QUEUED',
         0, @maxAttempts, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `).run({
      recipientUserId, channel, eventType,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      dedupeKey, title, message,
      payloadJson: JSON.stringify(payload ?? {}),
      maxAttempts,
    });
    return info.lastInsertRowid ? findById(db, Number(info.lastInsertRowid)) : null;
  } catch (err) {
    if (err && String(err.code || '').startsWith('SQLITE_CONSTRAINT_UNIQUE')) return null;
    throw err;
  }
}

function getDueBatch(db, batchSize) {
  return db.prepare(`
    SELECT * FROM notifications
     WHERE status = 'QUEUED'
       AND (next_attempt_at IS NULL OR next_attempt_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ORDER BY queued_at ASC, id ASC
     LIMIT ?
  `).all(batchSize);
}

function markSent(db, id) {
  return db.prepare(`
    UPDATE notifications
       SET status = 'SENT',
           sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           attempt_count = attempt_count + 1,
           last_error = NULL,
           next_attempt_at = NULL
     WHERE id = ?
  `).run(id);
}

function markRetry(db, id, nextAttemptAt, safeError) {
  return db.prepare(`
    UPDATE notifications
       SET attempt_count = attempt_count + 1,
           status = 'QUEUED',
           next_attempt_at = ?,
           last_error = ?
     WHERE id = ?
  `).run(nextAttemptAt, safeError, id);
}

function markFailed(db, id, safeError) {
  return db.prepare(`
    UPDATE notifications
       SET status = 'FAILED',
           attempt_count = attempt_count + 1,
           failed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           next_attempt_at = NULL,
           last_error = ?
     WHERE id = ?
  `).run(safeError, id);
}

function markRead(notificationId, recipientUserId) {
  return getDb().prepare(`
    UPDATE notifications
       SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     WHERE id = ? AND recipient_user_id = ?
  `).run(notificationId, recipientUserId);
}

function countUnread(recipientUserId) {
  return getDb()
    .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL`)
    .get(recipientUserId).n;
}

function list(recipientUserId, { limit = 25, offset = 0, unreadOnly = false, eventType = null } = {}) {
  let where = 'WHERE recipient_user_id = @recipientUserId';
  const params = { recipientUserId, limit, offset };
  if (unreadOnly) where += ' AND read_at IS NULL';
  if (eventType) { where += ' AND event_type = @eventType'; params.eventType = eventType; }
  return getDb()
    .prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all(params);
}

function findOwned(notificationId, recipientUserId) {
  return getDb()
    .prepare(`SELECT * FROM notifications WHERE id = ? AND recipient_user_id = ?`)
    .get(notificationId, recipientUserId) ?? null;
}

function findById(db, id) {
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) ?? null;
}

function listFailed(limit = 50) {
  return getDb()
    .prepare(`SELECT id, event_type, channel, attempt_count, max_attempts, last_error, failed_at, recipient_user_id
                 FROM notifications WHERE status = 'FAILED' ORDER BY failed_at DESC LIMIT ?`)
    .all(limit);
}

function requeueFailed(notificationId) {
  return getDb().prepare(`
    UPDATE notifications
       SET status = 'QUEUED', next_attempt_at = NULL, failed_at = NULL, last_error = NULL
     WHERE id = ? AND status = 'FAILED'
  `).run(notificationId);
}

module.exports = { insertQueued, getDueBatch, markSent, markRetry, markFailed, markRead, countUnread, list, findOwned, findById, listFailed, requeueFailed };
