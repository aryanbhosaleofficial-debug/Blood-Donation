'use strict';

/**
 * modules/cleanup/request-expiry.transaction
 *
 * Atomic request-expiry logic using BEGIN IMMEDIATE semantics.
 *
 * Transaction contract (all-or-nothing):
 *   1. Re-read the request and confirm it is still eligible (OPEN/COVERED, past expiry).
 *   2. Find all RESERVED allocations.
 *   3. For each RESERVED allocation:
 *        - Restore exactly units_reserved to inventory (with version increment).
 *        - Insert an inventory_adjustment record (actor_user_id = NULL for system).
 *        - Mark the allocation RELEASED.
 *   4. Expire active donor pledges (PLEDGED → EXPIRED, ARRIVED → CLOSED).
 *   5. Close active donor alerts.
 *   6. Delete donor_location_sessions for the request.
 *   7. Close broadcasts.
 *   8. Mark the request EXPIRED, set closed_at.
 *   9. Queue REQUEST_EXPIRED notifications (inside transaction for outbox safety).
 *   10. Insert audit log row.
 *
 * Idempotency:
 *   - Step 1 re-checks status; a second run finds EXPIRED and returns null (no-op).
 *   - Notification deduplication uses deterministic dedupe keys.
 *   - Inventory restoration only runs for RESERVED allocations (not RELEASED/COMPLETED).
 */

const config = require('../../core/config');
const { getDb } = require('../../core/database');
const { ConflictError } = require('../../core/errors');
const { EXPIRY_RESTORATION_REASON, ACTIVE_REQUEST_STATUSES } = require('./cleanup.constants');
const { queueNotification } = require('../notifications/notifications.outbox');
const { NOTIFICATION_EVENT, NOTIFICATION_ENTITY } = require('../notifications/notifications.constants');
const { buildRequestExpiredNotification } = require('../notifications/notification-builders');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

/**
 * Restore inventory for one RESERVED allocation (within an existing transaction).
 * Returns the new units_available value.
 *
 * @throws ConflictError if restoration would exceed INVENTORY_MAX_UNITS or CAS fails.
 */
function restoreInventory(db, { bankId, bloodGroup, component, units, requestId }) {
  const inventory = db.prepare(
    'SELECT * FROM inventory WHERE bank_id = ? AND blood_group = ? AND component = ?'
  ).get(bankId, bloodGroup, component);

  if (!inventory) {
    throw new ConflictError(
      `Inventory not found for bank ${bankId} ${bloodGroup} ${component} — cannot restore.`,
      { code: 'EXPIRY_INVENTORY_NOT_FOUND' }
    );
  }

  const newUnits = inventory.units_available + units;
  if (newUnits > config.inventoryMaxUnits) {
    throw new ConflictError(
      `Restoring ${units} units would push inventory ${inventory.id} above INVENTORY_MAX_UNITS.`,
      { code: 'EXPIRY_INVENTORY_LIMIT' }
    );
  }

  const result = db.prepare(`
    UPDATE inventory
    SET units_available = units_available + ?,
        version = version + 1,
        updated_by_user_id = NULL,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND bank_id = ? AND units_available + ? <= ?
  `).run(units, inventory.id, bankId, units, config.inventoryMaxUnits);

  if (result.changes !== 1) {
    throw new ConflictError(
      `Inventory ${inventory.id} changed during expiry restoration (CAS miss).`,
      { code: 'EXPIRY_INVENTORY_CHANGED' }
    );
  }

  // Record inventory adjustment — actor_user_id = NULL for system action.
  db.prepare(`
    INSERT INTO inventory_adjustments
      (inventory_id, bank_id, actor_user_id, previous_units, new_units,
       previous_version, new_version, reason)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(
    inventory.id, bankId,
    inventory.units_available, newUnits,
    inventory.version, inventory.version + 1,
    `${EXPIRY_RESTORATION_REASON}:req=${requestId}`
  );

  return newUnits;
}

/**
 * Create the expiry transaction factory.
 *
 * @param {import('better-sqlite3').Database} [db]
 * @returns {{ expireRequest: Function }}
 */
function createExpiryTransaction(db = getDb()) {
  /**
   * Atomically expire a single request.
   *
   * @param {object} opts
   * @param {number} opts.requestId
   * @param {string} opts.nowIso  — UTC ISO string (injectable for testing)
   * @returns {object|null}  result object if expired, null if already in terminal state
   */
  const expireRequest = db.transaction(({ requestId, nowIso }) => {
    // 1. Re-read request — confirm it is still eligible.
    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
    if (!request) return null;
    if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) return null; // already terminal
    if (request.expires_at > nowIso) return null; // no longer expired (clock/test scenario)

    const previousStatus = request.status;

    // 2. Find all RESERVED allocations.
    const reservedAllocations = db.prepare(`
      SELECT a.*, r.blood_group, r.component
      FROM request_allocations a
      JOIN requests r ON r.id = a.request_id
      WHERE a.request_id = ? AND a.status = 'RESERVED'
    `).all(requestId);

    // 3. Restore inventory for each RESERVED allocation.
    for (const alloc of reservedAllocations) {
      restoreInventory(db, {
        bankId: alloc.bank_id,
        bloodGroup: alloc.blood_group,
        component: alloc.component,
        units: alloc.units_reserved,
        requestId,
      });

      // Mark allocation RELEASED.
      db.prepare(`
        UPDATE request_allocations
        SET status = 'RELEASED',
            released_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND status = 'RESERVED'
      `).run(alloc.id);
    }

    // 4. Expire active donor pledges:
    //    PLEDGED → EXPIRED  (they pledged but request expired before they arrived)
    //    ARRIVED → CLOSED   (they arrived but request expired; acknowledge arrival, no clinical outcome implied)
    db.prepare(`
      UPDATE donor_pledges
      SET status = 'EXPIRED',
          closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE request_id = ? AND status = 'PLEDGED'
    `).run(requestId);

    db.prepare(`
      UPDATE donor_pledges
      SET status = 'CLOSED',
          closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE request_id = ? AND status = 'ARRIVED'
    `).run(requestId);

    // Count pledges affected for audit metadata.
    const expiredPledgeCount = db.prepare(
      "SELECT COUNT(*) AS n FROM donor_pledges WHERE request_id = ? AND status IN ('EXPIRED','CLOSED') AND closed_at >= ?"
    ).get(requestId, nowIso).n;

    // Per-pledge audit rows (system actor). Idempotent: a second run finds no
    // PLEDGED/ARRIVED pledges, so no further rows are written.
    const affectedPledges = db.prepare(
      "SELECT id, status FROM donor_pledges WHERE request_id = ? AND status IN ('EXPIRED','CLOSED') AND closed_at >= ?"
    ).all(requestId, nowIso);
    for (const p of affectedPledges) {
      db.prepare(`
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
        VALUES (NULL, ?, ?, ?, ?)
      `).run(
        AUDIT_ACTION.DONOR_PLEDGE_EXPIRED,
        AUDIT_ENTITY.PLEDGE,
        p.id,
        JSON.stringify({ requestId, statusTo: p.status, viaRequestExpiry: true })
      );
    }

    // 5. Close active donor alerts.
    db.prepare(`
      UPDATE donor_alerts
      SET status = 'CLOSED',
          closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE request_id = ? AND status IN ('ACTIVE', 'VIEWED')
    `).run(requestId);

    // 6. Delete donor_location_sessions for this request (exact coordinates are ephemeral).
    db.prepare('DELETE FROM donor_location_sessions WHERE request_id = ?').run(requestId);

    // 7. Close broadcasts.
    db.prepare(`
      UPDATE request_broadcasts
      SET status = 'CLOSED',
          responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE request_id = ? AND status <> 'CLOSED'
    `).run(requestId);

    // 8. Mark request EXPIRED with closed_at.
    db.prepare(`
      UPDATE requests
      SET status = 'EXPIRED',
          closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND status IN ('OPEN', 'COVERED')
    `).run(requestId);

    // 9. Queue notifications — inside transaction (outbox pattern).
    //    Notify hospital user.
    const hospitalRow = db.prepare(`
      SELECT h.user_id FROM requests r JOIN hospitals h ON h.id = r.hospital_id WHERE r.id = ?
    `).get(requestId);

    const notifiedUserIds = new Set();

    if (hospitalRow) {
      queueNotification(db, {
        recipientUserId: hospitalRow.user_id,
        ...buildRequestExpiredNotification({ requestId, recipientUserId: hospitalRow.user_id }),
      });
      notifiedUserIds.add(hospitalRow.user_id);
    }

    // Notify bank users with broadcasts.
    const bankUserRows = db.prepare(`
      SELECT DISTINCT u.id AS user_id
      FROM request_broadcasts rb
      JOIN blood_banks bb ON bb.id = rb.bank_id
      JOIN users u ON u.id = bb.user_id
      WHERE rb.request_id = ?
    `).all(requestId);

    for (const { user_id } of bankUserRows) {
      if (!notifiedUserIds.has(user_id)) {
        queueNotification(db, {
          recipientUserId: user_id,
          ...buildRequestExpiredNotification({ requestId, recipientUserId: user_id }),
        });
        notifiedUserIds.add(user_id);
      }
    }

    // 10. Insert audit log row (inside transaction).
    db.prepare(`
      INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
      VALUES (NULL, ?, ?, ?, ?)
    `).run(
      AUDIT_ACTION.REQUEST_EXPIRED,
      AUDIT_ENTITY.REQUEST,
      requestId,
      JSON.stringify({
        previousStatus,
        releasedAllocationCount: reservedAllocations.length,
        expiredPledgeCount,
      })
    );

    return {
      requestId,
      previousStatus,
      releasedAllocationCount: reservedAllocations.length,
      expiredPledgeCount,
    };
  });

  return {
    /**
     * @param {object} opts
     * @param {number} opts.requestId
     * @param {string} opts.nowIso
     * @returns {object|null}
     */
    expireRequest: (opts) => expireRequest.immediate(opts),
  };
}

module.exports = { createExpiryTransaction };
