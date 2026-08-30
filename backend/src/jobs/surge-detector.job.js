'use strict';

/**
 * jobs/surge-detector.job
 *
 * Recurring background job that looks for unusual blood-demand patterns and
 * raises PENDING surge candidates for ADMIN review.
 *
 * This job NEVER confirms a surge and never predicts a disaster — it only
 * observes request demand inside this platform.
 *
 * Lifecycle:
 *   start() -> schedules recurring detection ticks + a slow baseline refresh
 *   stop()  -> clears both timers; an in-flight pass finishes, then stops
 *
 * Reentrancy protection: an isRunning flag prevents overlapping passes.
 * The one-shot startup pass is run by surge.service.runStartupTasks() before
 * this job is started (see server.js).
 *
 * Failure isolation: a detection error is logged with safe context (never
 * request content) and does not crash Express.
 */

const config = require('../core/config');
const logger = require('../core/logger');
const surgeService = require('../modules/surge/surge.service');

let detectTimer = null;
let refreshTimer = null;
let isRunning = false;
let jobStatus = 'stopped'; // 'running' | 'stopped'
let lastRunAt = null;

function scheduleNextDetect() {
  if (jobStatus !== 'running') return;
  detectTimer = setTimeout(detectTick, config.surge.detectorIntervalMs);
}

function scheduleNextRefresh() {
  if (jobStatus !== 'running') return;
  refreshTimer = setTimeout(refreshTick, config.surge.baselineRefreshIntervalMs);
}

async function detectTick() {
  if (isRunning) {
    scheduleNextDetect();
    return;
  }
  isRunning = true;
  const start = Date.now();
  try {
    const result = surgeService.runDetectionPass();
    lastRunAt = new Date().toISOString();
    const created = result.real.created + result.demo.created;
    if (created > 0) {
      logger.info('surge detector pass created candidates', {
        realCreated: result.real.created,
        demoCreated: result.demo.created,
        durationMs: Date.now() - start,
      });
    }
  } catch (err) {
    logger.error('surge detector pass error', { code: err.code, message: err.message });
  } finally {
    isRunning = false;
    scheduleNextDetect();
  }
}

function refreshTick() {
  try {
    surgeService.refreshBaseline();
  } catch (err) {
    logger.error('surge baseline refresh error', { message: err.message });
  } finally {
    scheduleNextRefresh();
  }
}

function start() {
  if (jobStatus === 'running') return;
  jobStatus = 'running';
  logger.info('surge detector job started', {
    intervalMs: config.surge.detectorIntervalMs,
    analysisWindowMinutes: config.surge.analysisWindowMinutes,
    baselineRefreshIntervalMs: config.surge.baselineRefreshIntervalMs,
  });
  scheduleNextDetect();
  scheduleNextRefresh();
}

function stop() {
  jobStatus = 'stopped';
  if (detectTimer) { clearTimeout(detectTimer); detectTimer = null; }
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  logger.info('surge detector job stopped');
}

function getStatus() {
  return jobStatus;
}

function getLastRunAt() {
  return lastRunAt;
}

module.exports = { start, stop, getStatus, getLastRunAt };
