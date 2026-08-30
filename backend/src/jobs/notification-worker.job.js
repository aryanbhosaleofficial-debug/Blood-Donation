'use strict';

/**
 * jobs/notification-worker.job
 *
 * Starts and stops the notification worker polling loop.
 *
 * Lifecycle:
 *   start()  -> begins polling at config.notificationWorkerIntervalMs
 *   stop()   -> clears the timer; in-flight batch completes, then stops
 *
 * Reentrancy protection: isRunning flag ensures a slow batch does not
 * overlap with the next tick.
 *
 * Recovery: QUEUED rows persist in SQLite. If the process restarts, the
 * worker picks them up on the next tick (at-least-once delivery).
 *
 * Single-process assumption: only one worker loop per process.
 * Multi-instance deployments would need distributed lease coordination.
 */

const config = require('../core/config');
const logger = require('../core/logger');
const { processBatch } = require('../modules/notifications/notification-worker.service');

let timer = null;
let isRunning = false;
let workerStatus = 'stopped'; // 'running' | 'stopped'

function scheduleNext() {
  if (workerStatus !== 'running') return;
  timer = setTimeout(tick, config.notificationWorkerIntervalMs);
}

async function tick() {
  if (isRunning) {
    // Previous batch still in-flight; try again after interval.
    scheduleNext();
    return;
  }

  isRunning = true;
  try {
    processBatch();
  } catch (err) {
    logger.error('notification worker error', { message: err.message });
  } finally {
    isRunning = false;
    scheduleNext();
  }
}

function start() {
  if (workerStatus === 'running') return;
  workerStatus = 'running';
  logger.info('notification worker started', {
    intervalMs: config.notificationWorkerIntervalMs,
    batchSize: config.notificationWorkerBatchSize,
    maxAttempts: config.notificationMaxAttempts,
  });
  scheduleNext();
}

function stop() {
  workerStatus = 'stopped';
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('notification worker stopped');
}

function getStatus() {
  return workerStatus;
}

module.exports = { start, stop, getStatus };
