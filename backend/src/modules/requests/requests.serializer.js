'use strict';

/**
 * modules/requests/requests.serializer
 *
 * Explicit output shaping. Raw DB rows are never returned.
 *
 * - hospitalView: everything the owning hospital (or an admin) may see.
 * - bankView: the request plus just enough facility context for a broadcast
 *   recipient; no hospital account/security/contact fields.
 */

function isPastExpiry(row, now = Date.now()) {
  const expiresAt = Date.parse(row.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function baseFields(row, now) {
  const allocated = Number(row.bank_units_allocated || 0);
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    bloodGroup: row.blood_group,
    component: row.component,
    unitsNeeded: row.units_needed,
    bankUnitsAllocated: allocated,
    remainingBankUnits: Math.max(row.units_needed - allocated, 0),
    backupSlots: row.backup_slots,
    urgency: row.urgency,
    status: row.status,
    note: row.note ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at ?? null,
    isPastExpiry: isPastExpiry(row, now),
  };
}

function hospitalView(row, now = Date.now()) {
  if (!row) return null;
  return {
    ...baseFields(row, now),
    hospitalId: row.hospital_id,
    isSynthetic: row.is_synthetic === 1,
    scenarioId: row.scenario_id ?? null,
    donorFallback: {
      status: Number(row.donor_alert_actionable || 0) > 0 ? 'ACTIVE' : Number(row.donor_alert_total || 0) > 0 ? 'CLOSED' : 'INACTIVE',
      potentialDonorsAlerted: Number(row.donor_alert_actionable || 0),
    },
    potentialDonorPledges: {
      active: Number(row.active_pledge_count || 0),
      maximum: Number(row.units_needed) + Number(row.backup_slots || 0),
      available: Math.max(Number(row.units_needed) + Number(row.backup_slots || 0) - Number(row.active_pledge_count || 0), 0),
    },
  };
}

/**
 * @param {object} row - a request row joined with hospital name/city/locality
 *                        as h_name / h_city / h_locality
 */
function bankView(row, now = Date.now()) {
  if (!row) return null;
  return {
    ...baseFields(row, now),
    hospital: {
      name: row.h_name ?? null,
      city: row.h_city ?? null,
      locality: row.h_locality ?? null,
    },
    broadcastStatus: row.broadcast_status ?? null,
    ownAllocation: row.own_allocation_id ? { id: row.own_allocation_id, status: row.own_allocation_status } : null,
  };
}

module.exports = { hospitalView, bankView, isPastExpiry };
