'use strict';

/**
 * modules/surge/surge.repository
 *
 * All SQL for surge detection: recent-demand reads, hospital facility
 * locations, matching recorded inventory, and surge_candidates / surge_events
 * CRUD. Parameterized statements only.
 *
 * PRIVACY: the detector only ever reads request timestamps, the requesting
 * hospital, city, blood group, component, units, urgency and the synthetic
 * flag. It never reads request notes, donor rows, or donor location sessions.
 */

const CANDIDATE_COLUMNS = `
  id, mode, city, blood_group, component,
  window_started_at, window_ended_at,
  observed_request_count, expected_lambda, poisson_tail_probability,
  distinct_hospital_count, velocity_ratio, previous_window_count,
  geographic_signal, geographic_radius_km,
  recorded_inventory_units, fresh_inventory_rows, stale_inventory_rows,
  inventory_depletion_units, signal_score, baseline_source,
  status, is_synthetic, dedupe_key,
  detected_at, reviewed_at, reviewed_by_user_id, review_note,
  created_at, updated_at
`;

// ── Demand reads ──────────────────────────────────────────────────────────

/**
 * Distinct (city, blood_group, component) groups with requests in the window.
 * @param {import('better-sqlite3').Database} db
 * @param {object} p  { startIso, endIso, isSynthetic }
 */
function candidateGroups(db, { startIso, endIso, isSynthetic }) {
  return db.prepare(`
    SELECT h.city AS city, r.blood_group AS bloodGroup, r.component AS component,
           COUNT(*) AS observed, COUNT(DISTINCT r.hospital_id) AS distinctHospitals
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.is_synthetic = ? AND r.created_at >= ? AND r.created_at < ?
    GROUP BY h.city, r.blood_group, r.component
  `).all(isSynthetic ? 1 : 0, startIso, endIso);
}

/**
 * Count requests for one group in an arbitrary window (used for velocity).
 */
function countRequestsInWindow(db, { city, bloodGroup, component, startIso, endIso, isSynthetic }) {
  return db.prepare(`
    SELECT COUNT(*) AS n
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE h.city = ? COLLATE NOCASE AND r.blood_group = ? AND r.component = ?
      AND r.is_synthetic = ? AND r.created_at >= ? AND r.created_at < ?
  `).get(city, bloodGroup, component, isSynthetic ? 1 : 0, startIso, endIso).n;
}

/**
 * Requesting-hospital facilities (id + coords) for a group in the window.
 */
function requestingHospitals(db, { city, bloodGroup, component, startIso, endIso, isSynthetic }) {
  return db.prepare(`
    SELECT DISTINCT h.id AS id, h.latitude AS latitude, h.longitude AS longitude,
           h.locality AS locality, h.pin_code AS pinCode
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE h.city = ? COLLATE NOCASE AND r.blood_group = ? AND r.component = ?
      AND r.is_synthetic = ? AND r.created_at >= ? AND r.created_at < ?
  `).all(city, bloodGroup, component, isSynthetic ? 1 : 0, startIso, endIso);
}

/**
 * Recorded matching red-cell inventory across verified+active banks in a city.
 * @returns { rows: object[] }  each: { unitsAvailable, updatedAt }
 */
function matchingInventory(db, { city, bloodGroup, component }) {
  return db.prepare(`
    SELECT i.units_available AS unitsAvailable, i.updated_at AS updatedAt
    FROM inventory i
    JOIN blood_banks b ON b.id = i.bank_id
    JOIN users u ON u.id = b.user_id
    WHERE b.city = ? COLLATE NOCASE AND i.blood_group = ? AND i.component = ?
      AND u.is_active = 1 AND u.is_verified = 1
  `).all(city, bloodGroup, component);
}

/**
 * Recorded matching-inventory depletion (sum of decreases) during the window.
 */
function inventoryDepletion(db, { city, bloodGroup, component, startIso, endIso }) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN a.new_units < a.previous_units
                             THEN a.previous_units - a.new_units ELSE 0 END), 0) AS depletion
    FROM inventory_adjustments a
    JOIN inventory i ON i.id = a.inventory_id
    JOIN blood_banks b ON b.id = i.bank_id
    WHERE b.city = ? COLLATE NOCASE AND i.blood_group = ? AND i.component = ?
      AND a.created_at >= ? AND a.created_at < ?
  `).get(city, bloodGroup, component, startIso, endIso);
  return row ? row.depletion : 0;
}

// ── Candidate CRUD ───────────────────────────────────────────────────────

/**
 * Insert a candidate, ignoring a duplicate dedupe_key.
 * @returns {object|null}  the row if newly inserted, null if it already existed
 */
function insertCandidate(db, c) {
  const info = db.prepare(`
    INSERT OR IGNORE INTO surge_candidates
      (mode, city, blood_group, component, window_started_at, window_ended_at,
       observed_request_count, expected_lambda, poisson_tail_probability,
       distinct_hospital_count, velocity_ratio, previous_window_count,
       geographic_signal, geographic_radius_km,
       recorded_inventory_units, fresh_inventory_rows, stale_inventory_rows,
       inventory_depletion_units, signal_score, baseline_source,
       status, is_synthetic, dedupe_key)
    VALUES
      (@mode, @city, @bloodGroup, @component, @windowStartedAt, @windowEndedAt,
       @observedRequestCount, @expectedLambda, @poissonTailProbability,
       @distinctHospitalCount, @velocityRatio, @previousWindowCount,
       @geographicSignal, @geographicRadiusKm,
       @recordedInventoryUnits, @freshInventoryRows, @staleInventoryRows,
       @inventoryDepletionUnits, @signalScore, @baselineSource,
       'PENDING', @isSynthetic, @dedupeKey)
  `).run(c);
  if (info.changes === 0) return null;
  return db.prepare(`SELECT ${CANDIDATE_COLUMNS} FROM surge_candidates WHERE id = ?`)
    .get(Number(info.lastInsertRowid));
}

function findCandidateById(db, id) {
  return db.prepare(`SELECT ${CANDIDATE_COLUMNS} FROM surge_candidates WHERE id = ?`).get(id);
}

function findCandidateByDedupe(db, dedupeKey) {
  return db.prepare(`SELECT ${CANDIDATE_COLUMNS} FROM surge_candidates WHERE dedupe_key = ?`).get(dedupeKey);
}

function listCandidates(db, { status, city, bloodGroup, isSynthetic, from, to, limit = 50, offset = 0 }) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (city) { where.push('city = ? COLLATE NOCASE'); params.push(city); }
  if (bloodGroup) { where.push('blood_group = ?'); params.push(bloodGroup); }
  if (isSynthetic != null) { where.push('is_synthetic = ?'); params.push(isSynthetic ? 1 : 0); }
  if (from) { where.push('detected_at >= ?'); params.push(from); }
  if (to) { where.push('detected_at <= ?'); params.push(to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM surge_candidates ${clause}`).get(...params).n;
  const rows = db.prepare(`
    SELECT ${CANDIDATE_COLUMNS} FROM surge_candidates ${clause}
    ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END, detected_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { rows, total };
}

function setCandidateReviewed(db, { id, status, reviewerId, note }) {
  return db.prepare(`
    UPDATE surge_candidates
    SET status = ?, reviewed_by_user_id = ?, review_note = ?,
        reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND status = 'PENDING'
  `).run(status, reviewerId, note ?? null, id);
}

function countByStatus(db) {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'STALE' THEN 1 ELSE 0 END) AS stale,
      SUM(CASE WHEN detected_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') THEN 1 ELSE 0 END) AS last24h
    FROM surge_candidates
  `).get();
}

// ── Event CRUD ───────────────────────────────────────────────────────────

function insertEvent(db, e) {
  const info = db.prepare(`
    INSERT INTO surge_events
      (candidate_id, city, blood_group, component, status,
       confirmed_by_user_id, summary, admin_note, is_synthetic)
    VALUES (@candidateId, @city, @bloodGroup, @component, 'ACTIVE',
            @confirmedByUserId, @summary, @adminNote, @isSynthetic)
  `).run(e);
  return db.prepare('SELECT * FROM surge_events WHERE id = ?').get(Number(info.lastInsertRowid));
}

function findEventById(db, id) {
  return db.prepare('SELECT * FROM surge_events WHERE id = ?').get(id);
}

function findEventByCandidate(db, candidateId) {
  return db.prepare('SELECT * FROM surge_events WHERE candidate_id = ?').get(candidateId);
}

function listEvents(db, { status, limit = 50, offset = 0 } = {}) {
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const total = db.prepare(`SELECT COUNT(*) AS n FROM surge_events ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT * FROM surge_events ${where}
    ORDER BY confirmed_at DESC, id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { rows, total };
}

function countActiveEvents(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM surge_events WHERE status = 'ACTIVE'").get().n;
}

module.exports = {
  candidateGroups,
  countRequestsInWindow,
  requestingHospitals,
  matchingInventory,
  inventoryDepletion,
  insertCandidate,
  findCandidateById,
  findCandidateByDedupe,
  listCandidates,
  setCandidateReviewed,
  countByStatus,
  insertEvent,
  findEventById,
  findEventByCandidate,
  listEvents,
  countActiveEvents,
};
