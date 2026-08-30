'use strict';

/**
 * Test helpers for Module 09 surge detection.
 * Requires an already-initialised DB (getDb()).
 */

const crypto = require('node:crypto');
const { getDb } = require('../../src/core/database');
const { createHospital } = require('./orgs');

const rid = () => crypto.randomBytes(5).toString('hex');

/**
 * Create N hospitals in a city, optionally with facility coordinates.
 * @returns {Promise<number[]>} hospital ids
 */
async function createCityHospitals(count, { city = 'Ahmedabad', concentrated = true } = {}) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const { hospital } = await createHospital({ city });
    // concentrated: ~a few km apart; spread: hundreds of km apart
    const step = concentrated ? 0.02 : 3;
    getDb().prepare('UPDATE hospitals SET latitude = ?, longitude = ? WHERE id = ?')
      .run(23.02 + i * step, 72.57 + i * step, hospital.id);
    ids.push(hospital.id);
  }
  return ids;
}

/**
 * Insert `count` requests spread across `hospitalIds`, ending at `endMs`.
 * @param {object} opts
 * @param {number[]} opts.hospitalIds
 * @param {number} opts.count
 * @param {number} [opts.endMs]
 * @param {boolean} [opts.synthetic]
 * @param {string} [opts.bloodGroup]
 * @param {number} [opts.spreadMinutes]  how far back the earliest request is
 */
function insertRequests({
  hospitalIds, count, endMs = Date.now(), synthetic = true,
  bloodGroup = 'O-', component = 'RED_CELLS', spreadMinutes = 40, scenarioId = null,
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, is_synthetic, scenario_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, 2, 0, 'CRITICAL', 'OPEN', ?, ?, ?, ?)
  `);
  const gap = count > 1 ? (spreadMinutes * 60 * 1000) / (count - 1) : 0;
  for (let i = 0; i < count; i += 1) {
    // shift 1s into the past so the newest request is strictly inside [start, end)
    const createdAt = new Date(endMs - 1000 - Math.round(i * gap)).toISOString();
    stmt.run(
      `sc-${rid()}`, hospitalIds[i % hospitalIds.length], bloodGroup, component,
      synthetic ? 1 : 0, scenarioId, createdAt,
      new Date(endMs + 3600000).toISOString(),
    );
  }
}

/** Give a city's verified banks some matching inventory + record a depletion. */
function seedInventory(bankId, { bloodGroup = 'O-', units = 3, depletionInWindowEndMs = null } = {}) {
  const db = getDb();
  const inv = db.prepare(
    "SELECT * FROM inventory WHERE bank_id = ? AND blood_group = ? AND component = 'RED_CELLS'"
  ).get(bankId, bloodGroup);
  db.prepare('UPDATE inventory SET units_available = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE id = ?')
    .run(units, inv.id);
  if (depletionInWindowEndMs != null) {
    db.prepare(`
      INSERT INTO inventory_adjustments (inventory_id, bank_id, actor_user_id, previous_units, new_units,
                                         previous_version, new_version, reason, created_at)
      VALUES (?, ?, NULL, ?, ?, 0, 1, 'REQUEST_ALLOCATION:test', ?)
    `).run(inv.id, bankId, units + 9, units, new Date(depletionInWindowEndMs - 5 * 60 * 1000).toISOString());
  }
}

module.exports = { createCityHospitals, insertRequests, seedInventory, rid };
