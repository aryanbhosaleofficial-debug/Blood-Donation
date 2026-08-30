'use strict';

/**
 * modules/surge/surge-detector.service
 *
 * The explainable multi-signal surge detector.
 *
 *   1. Compute a rolling analysis window ending "now".
 *   2. Find (city, blood_group, component) groups with requests in the window
 *      (REAL mode → non-synthetic requests; DEMO mode → synthetic scenario
 *      requests). Request NOTES / donor data are never read.
 *   3. Look up the expected per-hour lambda from the matching baseline
 *      (REAL → non-synthetic baseline; DEMO → synthetic baseline) and scale it
 *      to the window length.
 *   4. Primary trigger:
 *          observed >= SURGE_MIN_REQUEST_COUNT
 *      AND poissonUpperTail(observed, lambdaWindow) < SURGE_P_VALUE_THRESHOLD
 *   5. Compute supporting signals (distinct hospitals, velocity, geographic
 *      concentration, inventory depletion) and a 0–100 ranking score.
 *   6. If triggered, INSERT OR IGNORE a PENDING candidate (deduped by a
 *      deterministic key). If a NEW candidate row was created, queue an
 *      ADMIN-only SURGE_CANDIDATE_DETECTED notification and write a
 *      SURGE_CANDIDATE_DETECTED audit row (system actor) — all in one
 *      transaction. The detector NEVER creates a CONFIRMED state.
 *
 * REAL mode with insufficient real baseline history is skipped (no candidate).
 */

const config = require('../../core/config');
const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const { ROLES } = require('../../core/constants');
const usersRepo = require('../users/users.repository');
const { queueNotification } = require('../notifications/notifications.outbox');
const { buildSurgeCandidateDetectedNotification } = require('../notifications/notification-builders');
const auditRepo = require('../audit/audit.repository');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

const { poissonUpperTail } = require('./poisson.service');
const { computeWindow, dedupeKey, localHour } = require('./surge.window');
const baselineService = require('./baseline.service');
const signals = require('./surge-signals.service');
const repo = require('./surge.repository');
const { SURGE_MODE, BASELINE_SOURCE } = require('./surge.constants');

/**
 * Evaluate one group and, if triggered, persist a candidate (+ notification +
 * audit) inside a single transaction.
 *
 * @returns {{ triggered: boolean, created: boolean, candidate: object|null, reason?: string }}
 */
function evaluateGroup(db, {
  mode, city, bloodGroup, component, win, nowMs,
}) {
  const isSynthetic = mode === SURGE_MODE.DEMO ? 1 : 0;

  const observed = repo.countRequestsInWindow(db, {
    city, bloodGroup, component,
    startIso: win.startIso, endIso: win.endIso, isSynthetic,
  });
  if (observed < config.surge.minRequestCount) {
    return { triggered: false, created: false, candidate: null, reason: 'below_min_count' };
  }

  const hour = localHour(win.endMs, config.appTimezone);
  const baseline = baselineService.getBaseline(db, { city, bloodGroup, component, localHour: hour, mode });
  if (!baseline) {
    return { triggered: false, created: false, candidate: null, reason: 'no_baseline' };
  }
  const lambdaWindow = baseline.lambdaHourly * (config.surge.analysisWindowMinutes / 60);
  const pTail = poissonUpperTail(observed, lambdaWindow);

  if (!Number.isFinite(pTail) || pTail >= config.surge.pValueThreshold) {
    return { triggered: false, created: false, candidate: null, reason: 'not_statistically_unusual' };
  }

  // ── Supporting signals ────────────────────────────────────────────────
  const prevCount = repo.countRequestsInWindow(db, {
    city, bloodGroup, component,
    startIso: win.prevStartIso, endIso: win.prevEndIso, isSynthetic,
  });
  const velocity = signals.velocityRatio(observed, prevCount);

  const hospitals = repo.requestingHospitals(db, {
    city, bloodGroup, component,
    startIso: win.startIso, endIso: win.endIso, isSynthetic,
  });
  const distinctHospitals = hospitals.length;
  const geo = signals.geographicSignal(hospitals);

  const invRows = repo.matchingInventory(db, { city, bloodGroup, component });
  const depletion = repo.inventoryDepletion(db, {
    city, bloodGroup, component, startIso: win.startIso, endIso: win.endIso,
  });
  const inventory = signals.inventorySignal(invRows, depletion, nowMs);

  const scored = signals.computeScore({
    pTail, observed, distinctHospitals, velocity, geographic: geo.signal, inventory,
  });

  const key = dedupeKey({ mode, city, bloodGroup, component, bucketId: win.bucketId });

  const candidateRow = {
    mode,
    city: String(city).trim(),
    bloodGroup,
    component,
    windowStartedAt: win.startIso,
    windowEndedAt: win.endIso,
    observedRequestCount: observed,
    expectedLambda: lambdaWindow,
    poissonTailProbability: pTail,
    distinctHospitalCount: distinctHospitals,
    velocityRatio: velocity,
    previousWindowCount: prevCount,
    geographicSignal: geo.signal,
    geographicRadiusKm: geo.radiusKm,
    recordedInventoryUnits: inventory.recordedUnits,
    freshInventoryRows: inventory.freshRows,
    staleInventoryRows: inventory.staleRows,
    inventoryDepletionUnits: inventory.depletionUnits,
    signalScore: scored.score,
    baselineSource: mode === SURGE_MODE.DEMO ? BASELINE_SOURCE.SYNTHETIC : BASELINE_SOURCE.REAL,
    isSynthetic,
    dedupeKey: key,
  };

  const persist = db.transaction(() => {
    const inserted = repo.insertCandidate(db, candidateRow);
    if (!inserted) {
      return { created: false, candidate: repo.findCandidateByDedupe(db, key) };
    }
    // ADMIN-only notification (never a public / donor / hospital broadcast).
    const admins = usersRepo.listActiveByRole(ROLES.ADMIN, db);
    for (const admin of admins) {
      queueNotification(db, {
        recipientUserId: admin.id,
        ...buildSurgeCandidateDetectedNotification({
          candidateId: inserted.id,
          city: inserted.city,
          bloodGroup: inserted.blood_group,
          component: inserted.component,
          recipientUserId: admin.id,
        }),
      });
    }
    auditRepo.insert(db, {
      actorUserId: null, // system detector
      action: AUDIT_ACTION.SURGE_CANDIDATE_DETECTED,
      entityType: AUDIT_ENTITY.SURGE_CANDIDATE,
      entityId: inserted.id,
      metadata: {
        mode,
        city: inserted.city,
        bloodGroup: inserted.blood_group,
        component: inserted.component,
        observed,
        expectedLambda: Number(lambdaWindow.toFixed(4)),
        poissonTailProbability: pTail,
        distinctHospitals,
        signalScore: scored.score,
        baselineSource: candidateRow.baselineSource,
      },
    });
    return { created: true, candidate: inserted };
  });

  const result = persist();
  return { triggered: true, created: result.created, candidate: result.candidate };
}

/**
 * Run one detection pass.
 *
 * @param {object} [opts]
 * @param {'REAL'|'DEMO'} [opts.mode]
 * @param {number} [opts.nowMs]
 * @param {import('better-sqlite3').Database} [opts.db]
 * @returns {{ mode: string, analyzed: number, triggered: number, created: number, skippedReason: string|null }}
 */
function runDetection({ mode = SURGE_MODE.REAL, nowMs = Date.now(), db = getDb() } = {}) {
  const win = computeWindow(nowMs, config.surge.analysisWindowMinutes);
  const isSynthetic = mode === SURGE_MODE.DEMO ? 1 : 0;

  if (mode === SURGE_MODE.REAL && !baselineService.hasSufficientRealBaseline(db, nowMs)) {
    logger.debug('surge detector: insufficient real baseline, REAL pass skipped');
    return { mode, analyzed: 0, triggered: 0, created: 0, skippedReason: 'insufficient_real_baseline' };
  }

  const groups = repo.candidateGroups(db, { startIso: win.startIso, endIso: win.endIso, isSynthetic });
  let triggered = 0;
  let created = 0;

  for (const g of groups) {
    try {
      const out = evaluateGroup(db, {
        mode, city: g.city, bloodGroup: g.bloodGroup, component: g.component, win, nowMs,
      });
      if (out.triggered) triggered += 1;
      if (out.created) created += 1;
    } catch (err) {
      // One group's failure must not abort the pass or crash the server.
      logger.error('surge detector: group evaluation failed', {
        city: g.city, bloodGroup: g.bloodGroup, component: g.component,
        code: err.code, message: err.message,
      });
    }
  }

  return { mode, analyzed: groups.length, triggered, created, skippedReason: null };
}

module.exports = { runDetection, evaluateGroup };
