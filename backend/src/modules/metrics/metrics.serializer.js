'use strict';

/**
 * modules/metrics/metrics.serializer
 *
 * Shapes raw aggregate rows into the admin metrics response.
 * Every field is a number or a short status string — never an individual
 * record, donor identity, contact detail, coordinate, or request note.
 *
 * Wording note (08.44 / 08.59): these are operational counts, NOT medical
 * outcomes, guaranteed availability, or surge predictions.
 */

const n = (v) => Number(v ?? 0);

function serialize({ requests, allocations, inventory, donors, alerts, pledges, notifications, cleanup, workers }) {
  return {
    requests: {
      total: n(requests.total),
      open: n(requests.open),
      covered: n(requests.covered),
      completed: n(requests.completed),
      cancelled: n(requests.cancelled),
      expired: n(requests.expired),
      synthetic: n(requests.synthetic),
      nonSynthetic: n(requests.nonSynthetic),
      byUrgency: {
        normal: n(requests.urgencyNormal),
        urgent: n(requests.urgencyUrgent),
        critical: n(requests.urgencyCritical),
      },
    },
    allocations: {
      total: n(allocations.total),
      reserved: n(allocations.reserved),
      released: n(allocations.released),
      completed: n(allocations.completed),
      totalUnitsReserved: n(allocations.totalUnitsReserved),
    },
    inventory: {
      totalRecordedRedCellUnits: n(inventory.totalRecordedRedCellUnits),
      staleInventoryRows: n(inventory.staleInventoryRows),
      freshInventoryRows: n(inventory.freshInventoryRows),
    },
    donors: {
      totalDonorProfiles: n(donors.totalDonorProfiles),
      available: n(donors.available),
      unavailable: n(donors.unavailable),
      unknown: n(donors.unknown),
      activeDonorAlerts: n(alerts.activeDonorAlerts),
    },
    pledges: {
      active: n(pledges.activePledges),
      arrived: n(pledges.arrivedPledges),
      cancelled: n(pledges.cancelledPledges),
      expired: n(pledges.expiredPledges),
      deferred: n(pledges.deferredPledges),
      closed: n(pledges.closedPledges),
    },
    notifications: {
      queued: n(notifications.queued),
      sent: n(notifications.sent),
      failed: n(notifications.failed),
      unread: n(notifications.unread),
    },
    cleanup: {
      pastDueActiveRequests: n(cleanup.pastDueActiveRequests),
      expiredLocationSessionsRemaining: n(cleanup.expiredLocationSessionsRemaining),
      lastRequestExpiryRunAt: cleanup.lastRequestExpiryRunAt ?? null,
      lastLocationCleanupRunAt: cleanup.lastLocationCleanupRunAt ?? null,
    },
    workers: {
      notification: String(workers.notification),
      requestExpiry: String(workers.requestExpiry),
      locationCleanup: String(workers.locationCleanup),
    },
  };
}

module.exports = { serialize };
