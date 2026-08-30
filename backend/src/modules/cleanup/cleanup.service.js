'use strict';

/**
 * modules/cleanup/cleanup.service
 *
 * Coordinates the one-shot startup cleanup sweeps.
 *
 * Startup sequence (see server.js):
 *   database ready -> server listening -> notification worker
 *                  -> request-expiry startup sweep
 *                  -> location-cleanup startup sweep
 *                  -> recurring jobs scheduled
 *
 * If the process was offline while requests / location sessions expired, the
 * startup sweep cleans them when the system returns. Each sweep is isolated:
 * a failure in one does not prevent the other, and never crashes startup.
 */

const logger = require('../../core/logger');
const requestExpiryService = require('./request-expiry.service');
const locationCleanupService = require('./location-cleanup.service');

/** Run a bounded request-expiry sweep. Never throws. */
function runStartupExpirySweep() {
  try {
    const result = requestExpiryService.processBatch();
    if (result.processed > 0) {
      logger.info('startup request-expiry sweep complete', result);
    }
    return result;
  } catch (err) {
    logger.error('startup request-expiry sweep failed', { message: err.message });
    return { processed: 0, expired: 0, errors: 1 };
  }
}

/** Run a bounded location-cleanup sweep. Never throws. */
function runStartupLocationCleanup() {
  try {
    const result = locationCleanupService.processBatch();
    if (result.deleted > 0) {
      logger.info('startup location-cleanup sweep complete', result);
    }
    return result;
  } catch (err) {
    logger.error('startup location-cleanup sweep failed', { message: err.message });
    return { scanned: 0, deleted: 0 };
  }
}

/** Run every startup sweep once. Never throws. */
function runStartupSweeps() {
  runStartupExpirySweep();
  runStartupLocationCleanup();
}

module.exports = { runStartupExpirySweep, runStartupLocationCleanup, runStartupSweeps };
