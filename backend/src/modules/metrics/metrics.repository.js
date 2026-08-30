'use strict';

/**
 * modules/metrics/metrics.repository
 *
 * Database queries for aggregate operational metrics.
 * All queries return aggregate counts — never individual rows with private data.
 */

const { getDb } = require('../../core/database');

/**
 * Request aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function requestCounts(db) {
  const rows = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'COVERED' THEN 1 ELSE 0 END) AS covered,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN is_synthetic = 1 THEN 1 ELSE 0 END) AS synthetic,
      SUM(CASE WHEN is_synthetic = 0 THEN 1 ELSE 0 END) AS nonSynthetic,
      SUM(CASE WHEN urgency = 'NORMAL' THEN 1 ELSE 0 END) AS urgencyNormal,
      SUM(CASE WHEN urgency = 'URGENT' THEN 1 ELSE 0 END) AS urgencyUrgent,
      SUM(CASE WHEN urgency = 'CRITICAL' THEN 1 ELSE 0 END) AS urgencyCritical
    FROM requests
  `).get();
  return rows;
}

/**
 * Allocation aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function allocationCounts(db) {
  return db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved,
      SUM(CASE WHEN status = 'RELEASED' THEN 1 ELSE 0 END) AS released,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
      COALESCE(SUM(units_reserved), 0) AS totalUnitsReserved
    FROM request_allocations
  `).get();
}

/**
 * Inventory aggregates (recorded units, stale/fresh row counts).
 * @param {import('better-sqlite3').Database} db
 * @param {number} staleMinutes
 */
function inventoryAggregates(db, staleMinutes) {
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  return db.prepare(`
    SELECT
      COALESCE(SUM(units_available), 0) AS totalRecordedRedCellUnits,
      SUM(CASE WHEN updated_at < ? THEN 1 ELSE 0 END) AS staleInventoryRows,
      SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS freshInventoryRows
    FROM inventory
  `).get(staleThreshold, staleThreshold);
}

/**
 * Donor profile aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function donorCounts(db) {
  return db.prepare(`
    SELECT
      COUNT(*) AS totalDonorProfiles,
      SUM(CASE WHEN availability_status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
      SUM(CASE WHEN availability_status = 'UNAVAILABLE' THEN 1 ELSE 0 END) AS unavailable,
      SUM(CASE WHEN availability_status = 'UNKNOWN' THEN 1 ELSE 0 END) AS unknown
    FROM donors
  `).get();
}

/**
 * Donor alert aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function donorAlertCounts(db) {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN status IN ('ACTIVE', 'VIEWED') THEN 1 ELSE 0 END) AS activeDonorAlerts
    FROM donor_alerts
  `).get();
}

/**
 * Donor pledge aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function pledgeCounts(db) {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'PLEDGED' THEN 1 ELSE 0 END) AS activePledges,
      SUM(CASE WHEN status = 'ARRIVED' THEN 1 ELSE 0 END) AS arrivedPledges,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledPledges,
      SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) AS expiredPledges,
      SUM(CASE WHEN status = 'DEFERRED' THEN 1 ELSE 0 END) AS deferredPledges,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS closedPledges
    FROM donor_pledges
  `).get();
}

/**
 * Notification aggregate counts.
 * @param {import('better-sqlite3').Database} db
 */
function notificationCounts(db) {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN status IN ('SENT', 'DELIVERED', 'ACKNOWLEDGED') THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN read_at IS NULL AND status IN ('SENT','DELIVERED','ACKNOWLEDGED') THEN 1 ELSE 0 END) AS unread
    FROM notifications
  `).get();
}

module.exports = {
  requestCounts,
  allocationCounts,
  inventoryAggregates,
  donorCounts,
  donorAlertCounts,
  pledgeCounts,
  notificationCounts,
};
