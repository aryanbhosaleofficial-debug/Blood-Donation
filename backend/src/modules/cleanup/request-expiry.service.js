'use strict';

/**
 * modules/cleanup/request-expiry.service
 *
 * Finds and processes a batch of expired emergency requests.
 * Each request is expired atomically via request-expiry.transaction.
 *
 * Safe by design:
 *   - Each request is expired in its own transaction (failure of one does not
 *     affect the others in the batch).
 *   - Idempotent: a re-run that finds already-EXPIRED requests returns null (no-op).
 *   - Reentrancy is protected at the job level (see request-expiry.job.js).
 */

const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const cleanupRepo = require('./cleanup.repository');
const { createExpiryTransaction } = require('./request-expiry.transaction');

/**
 * Process one batch of expired requests.
 *
 * @param {object} [opts]
 * @param {number} [opts.batchSize]
 * @param {string} [opts.nowIso]       — injectable for testing
 * @param {import('better-sqlite3').Database} [opts.db] — injectable for testing
 * @returns {object} { processed, expired, errors }
 */
function processBatch({ batchSize, nowIso, db } = {}) {
  const conn = db ?? getDb();
  const now = nowIso ?? new Date().toISOString();
  const size = batchSize ?? require('../../core/config').requestExpiryBatchSize;

  const expiredRequests = cleanupRepo.findExpiredRequests(conn, { batchSize: size, nowIso: now });
  const { expireRequest } = createExpiryTransaction(conn);

  let expired = 0;
  let errors = 0;

  for (const request of expiredRequests) {
    try {
      const result = expireRequest({ requestId: request.id, nowIso: now });
      if (result) {
        expired++;
        logger.info('request expired', {
          requestId: request.id,
          previousStatus: result.previousStatus,
          releasedAllocationCount: result.releasedAllocationCount,
          expiredPledgeCount: result.expiredPledgeCount,
        });
      } else {
        // Already in terminal state — no-op (idempotent).
        logger.debug('request already terminal, skipping', { requestId: request.id });
      }
    } catch (err) {
      errors++;
      // Log safe context only — no coordinates, no donor private data.
      logger.error('request expiry failed', {
        requestId: request.id,
        code: err.code,
        message: err.message,
      });
      // Continue to next request — do not crash the batch.
    }
  }

  return { processed: expiredRequests.length, expired, errors };
}

module.exports = { processBatch };
