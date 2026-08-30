'use strict';

/**
 * modules/notifications/notification-worker.service
 *
 * Core worker logic: query due QUEUED notifications, resolve provider,
 * attempt delivery, update status, schedule retry or mark FAILED.
 *
 * Key design principles:
 *   1. SQLite is the source of truth (not in-memory queue).
 *   2. Provider calls only happen here, never in domain transactions.
 *   3. Reentrancy protection via isRunning flag.
 *   4. Bounded exponential backoff: base * 2^(attempt-1).
 *   5. Error messages are sanitized before being stored/logged.
 *   6. At-least-once delivery semantics (crash-before-markSent = re-delivery).
 *
 * Limitation (documented):
 *   If the process crashes after the provider accepts but before markSent,
 *   the notification will be retried on restart. This gives at-least-once
 *   delivery, not exactly-once. The IN_APP provider is idempotent (the row
 *   already exists), so duplicate delivery is harmless for the MVP.
 *
 * Single-process assumption:
 *   One worker loop per process. A future multi-instance deployment would
 *   need stronger claiming/lease coordination or a production queue.
 */

const config = require('../../core/config');
const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const repo = require('./notifications.repository');
const inAppProvider = require('./providers/in-app.provider');
const { ProviderError } = require('./providers/provider.interface');

/** Map channel -> provider instance. Only IN_APP is required for the MVP. */
const PROVIDERS = {
  IN_APP: inAppProvider,
};

/** Sanitize an error message before storing/logging (no secrets, bounded). */
function safeError(err, maxLen = 200) {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  return raw.slice(0, maxLen).replace(/bearer\s+\S+/gi, '[redacted]');
}

/**
 * Calculate the next attempt timestamp using bounded exponential backoff.
 * formula: base * 2^(attempt - 1)  where attempt is 1-indexed.
 */
function calcNextAttemptAt(attemptCount) {
  const delay = config.notificationRetryBaseMs * Math.pow(2, attemptCount);
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Process a single notification row. Returns 'sent' | 'retry' | 'failed'.
 * @param {object} notification - raw DB row
 * @param {import('better-sqlite3').Database} db
 * @param {object|null} overrideProvider - optional provider for testing
 */
function processOne(notification, db, overrideProvider = null) {
  const provider = overrideProvider ?? PROVIDERS[notification.channel];

  if (!provider) {
    // Unknown channel - mark failed immediately (permanent)
    const err = `No provider for channel: ${notification.channel}`;
    repo.markFailed(db, notification.id, err);
    logger.warn('notification failed: no provider', { id: notification.id, channel: notification.channel });
    return 'failed';
  }

  try {
    provider.send(notification);
    repo.markSent(db, notification.id);
    logger.info('notification sent', {
      id: notification.id,
      eventType: notification.event_type,
      channel: notification.channel,
      attempt: notification.attempt_count + 1,
    });
    return 'sent';
  } catch (err) {
    const isPermanent = err instanceof ProviderError && err.permanent;
    const nextAttempt = notification.attempt_count + 1;
    const safe = safeError(err);

    if (isPermanent || nextAttempt >= notification.max_attempts) {
      repo.markFailed(db, notification.id, safe);
      logger.warn('notification failed permanently', {
        id: notification.id,
        eventType: notification.event_type,
        channel: notification.channel,
        attempt: nextAttempt,
        error: safe,
      });
      return 'failed';
    }

    const nextAttemptAt = calcNextAttemptAt(nextAttempt);
    repo.markRetry(db, notification.id, nextAttemptAt, safe);
    logger.info('notification retry scheduled', {
      id: notification.id,
      eventType: notification.event_type,
      channel: notification.channel,
      attempt: nextAttempt,
      nextAttemptAt,
    });
    return 'retry';
  }
}

/**
 * Process one batch of due notifications.
 * @param {object} [opts]
 * @param {object|null} [opts.overrideProvider] - for testing
 * @returns {{ processed: number, sent: number, retried: number, failed: number }}
 */
function processBatch({ overrideProvider = null } = {}) {
  const db = getDb();
  const batch = repo.getDueBatch(db, config.notificationWorkerBatchSize);
  const stats = { processed: batch.length, sent: 0, retried: 0, failed: 0 };

  for (const notification of batch) {
    const result = processOne(notification, db, overrideProvider);
    if (result === 'sent') stats.sent += 1;
    else if (result === 'retry') stats.retried += 1;
    else stats.failed += 1;
  }

  if (batch.length > 0) {
    logger.info('notification worker batch complete', stats);
  }

  return stats;
}

module.exports = { processBatch, processOne, safeError, calcNextAttemptAt };
