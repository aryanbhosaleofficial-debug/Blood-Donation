'use strict';

const { serializeBands } = require('../eta/eta.serializer');

function donorView(row, now = Date.now()) {
  if (!row) return null;
  const sharing = Number.isFinite(Date.parse(row.location_expires_at)) && Date.parse(row.location_expires_at) > now;
  return {
    id: row.id,
    publicReference: row.public_reference,
    request: {
      id: row.request_id,
      bloodGroup: row.blood_group,
      component: row.component,
      urgency: row.urgency,
      status: row.request_status,
      expiresAt: row.expires_at,
    },
    hospital: {
      name: row.hospital_name,
      city: row.hospital_city,
      locality: row.hospital_locality,
    },
    status: row.status,
    pledgedAt: row.pledged_at,
    arrivedAt: row.arrived_at,
    cancelledAt: row.cancelled_at,
    closedAt: row.closed_at,
    locationSharing: {
      isActive: sharing,
      expiresAt: sharing ? row.location_expires_at : null,
    },
  };
}

function hospitalView(row, now = Date.now()) {
  return {
    publicReference: row.public_reference,
    status: row.status,
    pledgedAt: row.pledged_at,
    arrivedAt: row.arrived_at,
    closedAt: row.closed_at,
    ...serializeBands(row, now),
  };
}

function hospitalSummary(request, rows, now = Date.now()) {
  const active = rows.filter((row) => ['PLEDGED', 'ARRIVED'].includes(row.status)).length;
  const max = Number(request.units_needed) + Number(request.backup_slots || 0);
  return {
    requestId: request.id,
    activePotentialDonorPledges: active,
    maxPledgeSlots: max,
    availablePledgeSlots: Math.max(max - active, 0),
    pledges: rows.map((row) => hospitalView(row, now)),
    disclaimer: 'Potential donor responses are for coordination only. Final screening and clinical readiness are determined by the blood bank.',
  };
}

module.exports = { donorView, hospitalView, hospitalSummary };
