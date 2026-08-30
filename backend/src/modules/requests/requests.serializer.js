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
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    bloodGroup: row.blood_group,
    component: row.component,
    unitsNeeded: row.units_needed,
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
  };
}

module.exports = { hospitalView, bankView, isPastExpiry };
