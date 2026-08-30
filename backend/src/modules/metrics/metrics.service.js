'use strict';

/**
 * modules/metrics/metrics.service
 *
 * Assembles operational aggregate metrics from repository queries.
 * Also incorporates in-process worker status from background jobs.
 *
 * Privacy guarantees:
 *   - All data is aggregate-only.
 *   - No donor identities, contact info, coordinates, or request notes are returned.
 *   - Metrics are NOT medical outcomes or surge predictions.
 */

const config = require('../../core/config');
const { getDb } = require('../../core/database');
const repo = require('./metrics.repository');
const serializer = require('./metrics.serializer');
const cleanupRepo = require('../cleanup/cleanup.repository');

// Lazy-loaded job references to avoid circular deps at module load time.
function getJobRefs() {
  return {
    notificationWorker: require('../../jobs/notification-worker.job'),
    requestExpiryJob: require('../../jobs/request-expiry.job'),
    locationCleanupJob: require('../../jobs/location-cleanup.job'),
    surgeDetectorJob: require('../../jobs/surge-detector.job'),
  };
}

/**
 * Gather all operational metrics.
 * @returns {object}
 */
function gatherMetrics() {
  const db = getDb();
  const nowIso = new Date().toISOString();

  // Database queries
  const requests = repo.requestCounts(db);
  const allocations = repo.allocationCounts(db);
  const inventory = repo.inventoryAggregates(db, config.inventoryStaleMinutes);
  const donors = repo.donorCounts(db);
  const alerts = repo.donorAlertCounts(db);
  const pledges = repo.pledgeCounts(db);
  const notifications = repo.notificationCounts(db);

  // Cleanup backlog
  const pastDueActiveRequests = cleanupRepo.countPastDueActiveRequests(db, nowIso);
  const expiredLocationSessionsRemaining = cleanupRepo.countExpiredLocationSessions(db, nowIso);

  // Worker status (in-process memory)
  const jobs = getJobRefs();

  // Module 09 — surge aggregates (counts only; no candidate evidence here).
  // eslint-disable-next-line global-require
  const surge = require('../surge/surge.service').surgeMetrics();

  return serializer.serialize({
    requests,
    allocations,
    inventory,
    donors,
    alerts,
    pledges,
    notifications,
    surge,
    cleanup: {
      pastDueActiveRequests,
      expiredLocationSessionsRemaining,
      lastRequestExpiryRunAt: jobs.requestExpiryJob.getLastRunAt(),
      lastLocationCleanupRunAt: jobs.locationCleanupJob.getLastRunAt(),
    },
    workers: {
      notification: jobs.notificationWorker.getStatus(),
      requestExpiry: jobs.requestExpiryJob.getStatus(),
      locationCleanup: jobs.locationCleanupJob.getStatus(),
      surgeDetector: jobs.surgeDetectorJob.getStatus(),
    },
  });
}

module.exports = { gatherMetrics };
