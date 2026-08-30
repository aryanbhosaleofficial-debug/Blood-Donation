'use strict';

/**
 * modules/surge/baseline.service
 *
 * Produces the per-local-hour expected-demand (Poisson lambda) baseline.
 *
 *   SYNTHETIC baseline (is_synthetic = 1)
 *     - deterministic cold-start data so anomaly-detection behaviour can be
 *       demonstrated before enough real platform history exists.
 *     - NEVER presented as learned real-world truth; used only in DEMO mode.
 *
 *   REAL baseline (is_synthetic = 0)
 *     - generated from requests WHERE is_synthetic = 0 over the recent
 *       SURGE_MIN_BASELINE_DAYS window, grouped by city / group / component /
 *       local-hour (configured timezone).
 *     - used in REAL mode only when enough history exists.
 */

const config = require('../../core/config');
const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const { BLOOD_GROUPS, COMPONENTS } = require('../../core/constants');
const { localHour } = require('./surge.window');
const { BASELINE_SOURCE, DEMO_SCENARIO_ID } = require('./surge.constants');
const repo = require('./baseline.repository');

const RED_CELLS = COMPONENTS.RED_CELLS;

// Cities covered by the synthetic cold-start baseline. Deliberately small —
// the demo scenario lives in Ahmedabad.
const SYNTHETIC_CITIES = Object.freeze(['Ahmedabad']);
const SYNTHETIC_BASE_LAMBDA = 0.5;      // requests/hour for an ordinary group
const SYNTHETIC_SCENARIO_LAMBDA = 1.0;  // Ahmedabad / O- / RED_CELLS
const SYNTHETIC_SAMPLE_DAYS = 30;

/**
 * Ensure the deterministic synthetic (DEMO) baseline exists. Idempotent.
 * @param {import('better-sqlite3').Database} [db]
 * @returns {{ rows: number }}
 */
function ensureSyntheticBaseline(db = getDb()) {
  let rows = 0;
  const apply = () => {
    for (const city of SYNTHETIC_CITIES) {
      for (const bloodGroup of BLOOD_GROUPS) {
        for (let hour = 0; hour < 24; hour += 1) {
          const isScenario = city === 'Ahmedabad' && bloodGroup === 'O-';
          repo.upsert(db, {
            city,
            bloodGroup,
            component: RED_CELLS,
            localHour: hour,
            lambda: isScenario ? SYNTHETIC_SCENARIO_LAMBDA : SYNTHETIC_BASE_LAMBDA,
            sampleDays: SYNTHETIC_SAMPLE_DAYS,
            requestCount: 0,
            isSynthetic: 1,
          });
          rows += 1;
        }
      }
    }
  };
  // Use a transaction only when not already inside one (better-sqlite3 has no
  // nested transactions).
  if (db.inTransaction) apply();
  else db.transaction(apply)();
  logger.info('synthetic surge baseline ensured', { rows, scenario: DEMO_SCENARIO_ID });
  return { rows };
}

/**
 * Regenerate the REAL baseline from non-synthetic request history.
 * @param {object} [opts]
 * @param {import('better-sqlite3').Database} [opts.db]
 * @param {number} [opts.nowMs]
 * @returns {{ groups: number, sampleDays: number, sufficient: boolean, sourceRequests: number }}
 */
function generateRealBaseline({ db = getDb(), nowMs = Date.now() } = {}) {
  const sampleDays = config.surge.minBaselineDays;
  const since = new Date(nowMs - sampleDays * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(nowMs).toISOString();

  const requests = db.prepare(`
    SELECT r.created_at AS createdAt, r.blood_group AS bloodGroup, r.component AS component,
           h.city AS city
    FROM requests r
    JOIN hospitals h ON h.id = r.hospital_id
    WHERE r.is_synthetic = 0 AND r.created_at >= ? AND r.created_at <= ?
  `).all(since, nowIso);

  // Is there actually >= sampleDays of history? (earliest real request)
  const earliest = db.prepare('SELECT MIN(created_at) AS c FROM requests WHERE is_synthetic = 0').get().c;
  const historyDays = earliest ? (nowMs - Date.parse(earliest)) / (24 * 60 * 60 * 1000) : 0;
  const sufficient = historyDays >= sampleDays && requests.length > 0;

  // Aggregate by city / group / component / local-hour.
  const buckets = new Map();
  for (const req of requests) {
    const hour = localHour(req.createdAt, config.appTimezone);
    const key = `${String(req.city).trim().toUpperCase()}|${req.bloodGroup}|${req.component}|${hour}`;
    const entry = buckets.get(key) || { city: req.city, bloodGroup: req.bloodGroup, component: req.component, hour, count: 0 };
    entry.count += 1;
    buckets.set(key, entry);
  }

  const write = db.transaction(() => {
    for (const entry of buckets.values()) {
      repo.upsert(db, {
        city: entry.city,
        bloodGroup: entry.bloodGroup,
        component: entry.component,
        localHour: entry.hour,
        lambda: entry.count / sampleDays,
        sampleDays,
        requestCount: entry.count,
        isSynthetic: 0,
        validFrom: since,
        validTo: nowIso,
      });
    }
  });
  write();

  logger.info('real surge baseline generated', {
    groups: buckets.size, sampleDays, sufficient, sourceRequests: requests.length,
  });
  return { groups: buckets.size, sampleDays, sufficient, sourceRequests: requests.length };
}

/**
 * Does REAL mode have a trustworthy baseline?
 * @param {import('better-sqlite3').Database} [db]
 * @param {number} [nowMs]
 * @returns {boolean}
 */
function hasSufficientRealBaseline(db = getDb(), nowMs = Date.now()) {
  if (repo.countBySynthetic(db, 0) === 0) return false;
  const earliest = db.prepare('SELECT MIN(created_at) AS c FROM requests WHERE is_synthetic = 0').get().c;
  if (!earliest) return false;
  const historyDays = (nowMs - Date.parse(earliest)) / (24 * 60 * 60 * 1000);
  return historyDays >= config.surge.minBaselineDays;
}

/**
 * Resolve the hourly lambda for a group in the given mode.
 * @returns {{ lambdaHourly: number, source: string, sampleDays: number } | null}
 */
function getBaseline(db, { city, bloodGroup, component, localHour: hour, mode }) {
  const isSynthetic = mode === 'DEMO' ? 1 : 0;
  const row = repo.find(db, { city, bloodGroup, component, localHour: hour, isSynthetic });
  if (!row) return null;
  return {
    lambdaHourly: row.lambda,
    source: isSynthetic ? BASELINE_SOURCE.SYNTHETIC : BASELINE_SOURCE.REAL,
    sampleDays: row.sample_days,
  };
}

module.exports = {
  ensureSyntheticBaseline,
  generateRealBaseline,
  hasSufficientRealBaseline,
  getBaseline,
  SYNTHETIC_CITIES,
};
