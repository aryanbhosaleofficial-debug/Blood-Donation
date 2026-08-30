'use strict';

/**
 * jobs/request-expiry.job
 *
 * Recurring background job that finds and expires past-due emergency requests.
 *
 * Lifecycle:
 *   start() -> begins polling at config.requestExpiryJobIntervalMs
 *   stop()  -> clears the timer; in-flight batch completes, then stops
 *
 * Reentrancy protection: isRunning flag prevents overlapping ticks.
 *
 * Startup sweep: the one-shot startup sweep is run by cleanup.service before
 * the recurring job is started (see server.js). This job only schedules the
 * recurring ticks.
 *
 * Recovery: SQLite persists state. If the process restarts, the startup sweep
 * plus the next recurring tick find any requests that expired while offline.
 */

const config = require('../core/config');
const logger = require('../core/logger');
const { processBatch } = require('../modules/cleanup/request-expiry.service');

let timer = null;
let isRunning = false;
let jobStatus = 'stopped'; // 'running' | 'stopped'
let lastRunAt = null;

function scheduleNext() {
  if (jobStatus !== 'running') return;
  timer = setTimeout(tick, config.requestExpiryJobIntervalMs);
}

async function tick() {
  if (isRunning) {
    // Previous batch still in-flight; try again after interval.
    scheduleNext();
    return;
  }

  isRunning = true;
  const start = Date.now();
  try {
    const result = processBatch();
    lastRunAt = new Date().toISOString();
    if (result.processed > 0) {
      logger.info('request expiry job completed', {
        processed: result.processed,
        expired: result.expired,
        errors: result.errors,
        durationMs: Date.now() - start,
      });
    }
  } catch (err) {
    logger.error('request expiry job error', { message: err.message });
  } finally {
    isRunning = false;
    scheduleNext();
  }
}

function start() {
  if (jobStatus === 'running') return;
  jobStatus = 'running';
  logger.info('request expiry job started', {
    intervalMs: config.requestExpiryJobIntervalMs,
    batchSize: config.requestExpiryBatchSize,
  });
  scheduleNext();
}

function stop() {
  jobStatus = 'stopped';
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('request expiry job stopped');
}

function getStatus() {
  return jobStatus;
}

function getLastRunAt() {
  return lastRunAt;
}

module.exports = { start, stop, getStatus, getLastRunAt };
