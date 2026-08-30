'use strict';

/**
 * jobs/location-cleanup.job
 *
 * Recurring background job that physically deletes expired temporary location
 * sessions from donor_location_sessions.
 *
 * Why physical DELETE (not soft-delete):
 *   Exact donor live coordinates are intentionally ephemeral. They must not
 *   persist after their TTL, even as "inactive" rows.
 *
 * Lifecycle:
 *   start() -> schedules recurring interval ticks
 *   stop()  -> clears timer; in-flight batch completes cleanly
 *
 * The one-shot startup sweep is run by cleanup.service before this job is
 * started (see server.js).
 *
 * Reentrancy protection: isRunning flag prevents overlapping ticks.
 */

const config = require('../core/config');
const logger = require('../core/logger');
const locationCleanupService = require('../modules/cleanup/location-cleanup.service');

let timer = null;
let isRunning = false;
let jobStatus = 'stopped';
let lastRunAt = null;

function scheduleNext() {
  if (jobStatus !== 'running') return;
  timer = setTimeout(tick, config.locationCleanupIntervalMs);
}

async function tick() {
  if (isRunning) {
    scheduleNext();
    return;
  }

  isRunning = true;
  const start = Date.now();
  try {
    const result = locationCleanupService.processBatch();
    lastRunAt = new Date().toISOString();
    if (result.deleted > 0) {
      logger.info('location cleanup job completed', {
        scanned: result.scanned,
        deleted: result.deleted,
        durationMs: Date.now() - start,
      });
    }
  } catch (err) {
    logger.error('location cleanup job error', { message: err.message });
  } finally {
    isRunning = false;
    scheduleNext();
  }
}

function start() {
  if (jobStatus === 'running') return;
  jobStatus = 'running';
  logger.info('location cleanup job started', {
    intervalMs: config.locationCleanupIntervalMs,
    batchSize: config.locationCleanupBatchSize,
  });
  scheduleNext();
}

function stop() {
  jobStatus = 'stopped';
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('location cleanup job stopped');
}

function getStatus() {
  return jobStatus;
}

function getLastRunAt() {
  return lastRunAt;
}

module.exports = { start, stop, getStatus, getLastRunAt };
