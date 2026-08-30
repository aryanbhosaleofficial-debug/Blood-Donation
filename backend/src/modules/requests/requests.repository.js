'use strict';

/**
 * modules/requests/requests.repository
 *
 * All SQL for the `requests` table. Parameterized statements only.
 * Functions that participate in a transaction take the db handle explicitly.
 */

const { getDb } = require('../../core/database');

const COLUMNS = `
  id, client_request_id, hospital_id, blood_group, component,
  units_needed, backup_slots, urgency, status, note,
  is_synthetic, scenario_id, created_at, expires_at, closed_at,
  (SELECT COALESCE(SUM(a.units_reserved), 0) FROM request_allocations a
    WHERE a.request_id = requests.id AND a.status IN ('RESERVED','COMPLETED')) AS bank_units_allocated,
  (SELECT COUNT(*) FROM donor_alerts da WHERE da.request_id=requests.id) AS donor_alert_total,
  (SELECT COUNT(*) FROM donor_alerts da WHERE da.request_id=requests.id AND da.status IN ('ACTIVE','VIEWED')) AS donor_alert_actionable,
  (SELECT COUNT(*) FROM donor_pledges dp WHERE dp.request_id=requests.id AND dp.status IN ('PLEDGED','ARRIVED')) AS active_pledge_count
`;

// request row joined with hospital facility context, for the bank view.
const BANK_SELECT = `
  SELECT r.id, r.client_request_id, r.hospital_id, r.blood_group, r.component,
         r.units_needed, r.backup_slots, r.urgency, r.status, r.note,
         r.is_synthetic, r.scenario_id, r.created_at, r.expires_at, r.closed_at,
         (SELECT COALESCE(SUM(a.units_reserved), 0) FROM request_allocations a
           WHERE a.request_id=r.id AND a.status IN ('RESERVED','COMPLETED')) AS bank_units_allocated,
         (SELECT a.status FROM request_allocations a
           WHERE a.request_id=r.id AND a.bank_id=rb.bank_id) AS own_allocation_status,
         (SELECT a.id FROM request_allocations a
           WHERE a.request_id=r.id AND a.bank_id=rb.bank_id) AS own_allocation_id,
         h.name AS h_name, h.city AS h_city, h.locality AS h_locality,
         rb.status AS broadcast_status
  FROM requests r
  JOIN hospitals h ON h.id = r.hospital_id
  JOIN request_broadcasts rb ON rb.request_id = r.id
`;

function findByClientId(db, hospitalId, clientRequestId) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM requests WHERE hospital_id = ? AND client_request_id = ?`)
    .get(hospitalId, clientRequestId);
}

function findById(id) {
  return getDb().prepare(`SELECT ${COLUMNS} FROM requests WHERE id = ?`).get(id);
}

function listByHospital(hospitalId, status) {
  if (status) {
    return getDb()
      .prepare(`SELECT ${COLUMNS} FROM requests WHERE hospital_id = ? AND status = ? ORDER BY datetime(created_at) DESC, id DESC`)
      .all(hospitalId, status);
  }
  return getDb()
    .prepare(`SELECT ${COLUMNS} FROM requests WHERE hospital_id = ? ORDER BY datetime(created_at) DESC, id DESC`)
    .all(hospitalId);
}

function listAll(status) {
  if (status) {
    return getDb()
      .prepare(`SELECT ${COLUMNS} FROM requests WHERE status = ? ORDER BY datetime(created_at) DESC, id DESC`)
      .all(status);
  }
  return getDb().prepare(`SELECT ${COLUMNS} FROM requests ORDER BY datetime(created_at) DESC, id DESC`).all();
}

/**
 * Requests visible to a bank: only those with a broadcast row for that bank.
 * Deterministic order: CRITICAL, then URGENT, then NORMAL; newest first within.
 */
function listForBank(bankId, status = 'OPEN') {
  const order = `
    ORDER BY CASE r.urgency WHEN 'CRITICAL' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END,
             datetime(r.created_at) DESC, r.id DESC
  `;
  if (status) {
    return getDb().prepare(`${BANK_SELECT} WHERE rb.bank_id = ? AND r.status = ? ${order}`).all(bankId, status);
  }
  return getDb().prepare(`${BANK_SELECT} WHERE rb.bank_id = ? ${order}`).all(bankId);
}

function findForBankById(bankId, requestId) {
  return getDb().prepare(`${BANK_SELECT} WHERE rb.bank_id = ? AND r.id = ?`).get(bankId, requestId);
}

function insert(db, data) {
  const info = db
    .prepare(
      `INSERT INTO requests
         (client_request_id, hospital_id, blood_group, component, units_needed,
          backup_slots, urgency, status, note, is_synthetic, scenario_id, expires_at)
       VALUES
         (@clientRequestId, @hospitalId, @bloodGroup, @component, @unitsNeeded,
          @backupSlots, @urgency, 'OPEN', @note, @isSynthetic, @scenarioId, @expiresAt)`,
    )
    .run({
      clientRequestId: data.clientRequestId,
      hospitalId: data.hospitalId,
      bloodGroup: data.bloodGroup,
      component: data.component,
      unitsNeeded: data.unitsNeeded,
      backupSlots: data.backupSlots,
      urgency: data.urgency,
      note: data.note ?? null,
      isSynthetic: data.isSynthetic ? 1 : 0,
      scenarioId: data.scenarioId ?? null,
      expiresAt: data.expiresAt,
    });
  return db.prepare(`SELECT ${COLUMNS} FROM requests WHERE id = ?`).get(Number(info.lastInsertRowid));
}

/** Transition to a terminal state and stamp closed_at. */
function close(db, id, status) {
  db.prepare(
    `UPDATE requests SET status = ?, closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(status, id);
  return db.prepare(`SELECT ${COLUMNS} FROM requests WHERE id = ?`).get(id);
}

function setStatus(db, id, status, closeRequest = false) {
  db.prepare(`UPDATE requests SET status=?, closed_at=${closeRequest ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'} WHERE id=?`).run(status,id);
  return db.prepare(`SELECT ${COLUMNS} FROM requests WHERE id=?`).get(id);
}

module.exports = {
  findByClientId,
  findById,
  listByHospital,
  listAll,
  listForBank,
  findForBankById,
  insert,
  close,
  setStatus,
};
