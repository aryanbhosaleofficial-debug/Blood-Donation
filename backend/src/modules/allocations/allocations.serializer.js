'use strict';

function base(row) {
  return {
    id: row.id,
    unitsReserved: row.units_reserved,
    status: row.status,
    reservedAt: row.reserved_at,
    releasedAt: row.released_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

function hospitalView(row) {
  return {
    ...base(row),
    bank: { id: row.bank_id, name: row.bank_name },
  };
}

function bankView(row) {
  return {
    ...base(row),
    request: {
      id: row.request_id,
      bloodGroup: row.blood_group,
      component: row.component,
      unitsNeeded: row.units_needed,
      urgency: row.urgency,
      status: row.request_status,
      hospitalName: row.hospital_name ?? null,
    },
  };
}

function reservationResult({ allocation, request, inventory, activeAllocated }) {
  return {
    allocation: base(allocation),
    request: {
      id: request.id,
      status: request.status,
      unitsNeeded: request.units_needed,
      bankUnitsAllocated: activeAllocated,
      remainingUnits: Math.max(request.units_needed - activeAllocated, 0),
    },
    inventory: {
      bloodGroup: inventory.blood_group,
      unitsAvailable: inventory.units_available,
      version: inventory.version,
    },
  };
}

module.exports = { base, hospitalView, bankView, reservationResult };
