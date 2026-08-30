'use strict';

/**
 * modules/surge/surge.service
 *
 * ADMIN-facing surge operations + startup / refresh orchestration.
 *
 * The detector only ever creates PENDING candidates. Converting a candidate
 * into a CONFIRMED operational surge is a human ADMIN action (confirm/reject).
 */

const config = require('../../core/config');
const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const { NotFoundError } = require('../../core/errors');

const repo = require('./surge.repository');
const serializer = require('./surge.serializer');
const baselineService = require('./baseline.service');
const detector = require('./surge-detector.service');
const { createSurgeReviewTransactions } = require('./surge.transaction');
const { SURGE_MODE, SURGE_ERROR } = require('./surge.constants');

// ── Read APIs ────────────────────────────────────────────────────────────

function listCandidates(filters) {
  const isSynthetic = filters.isSynthetic == null ? null : filters.isSynthetic === 'true';
  const { rows, total } = repo.listCandidates(getDb(), { ...filters, isSynthetic });
  return serializer.candidatePage(rows, total, filters.limit, filters.offset);
}

function getCandidate(candidateId) {
  const row = repo.findCandidateById(getDb(), candidateId);
  if (!row) throw new NotFoundError('Surge candidate not found.', { code: SURGE_ERROR.CANDIDATE_NOT_FOUND });
  const event = repo.findEventByCandidate(getDb(), candidateId);
  return { candidate: serializer.candidateView(row), event: serializer.eventView(event) };
}

function listEvents(filters) {
  const { rows, total } = repo.listEvents(getDb(), filters);
  return serializer.eventPage(rows, total, filters.limit, filters.offset);
}

function getEvent(eventId) {
  const row = repo.findEventById(getDb(), eventId);
  if (!row) throw new NotFoundError('Surge event not found.', { code: SURGE_ERROR.EVENT_NOT_FOUND });
  return { event: serializer.eventView(row) };
}

// ── Review actions ───────────────────────────────────────────────────────

function confirmCandidate(adminId, candidateId, note) {
  const { candidate, event } = createSurgeReviewTransactions().confirm({ candidateId, adminId, note });
  logger.info('surge candidate confirmed', { candidateId, eventId: event.id, adminId });
  return { candidate: serializer.candidateView(candidate), event: serializer.eventView(event) };
}

function rejectCandidate(adminId, candidateId, note) {
  const { candidate } = createSurgeReviewTransactions().reject({ candidateId, adminId, note });
  logger.info('surge candidate rejected', { candidateId, adminId });
  return { candidate: serializer.candidateView(candidate) };
}

// ── Detection orchestration ──────────────────────────────────────────────

/**
 * One detector pass over both modes. DEMO always runs (synthetic baseline
 * exists); REAL runs only when there is enough real history.
 * @param {number} [nowMs]
 */
function runDetectionPass(nowMs = Date.now()) {
  const real = detector.runDetection({ mode: SURGE_MODE.REAL, nowMs });
  const demo = detector.runDetection({ mode: SURGE_MODE.DEMO, nowMs });
  return { real, demo };
}

/**
 * Regenerate the REAL baseline. Called at startup and on a slow interval —
 * never on every detector tick.
 * @param {number} [nowMs]
 */
function refreshBaseline(nowMs = Date.now()) {
  return baselineService.generateRealBaseline({ nowMs });
}

/**
 * One-shot startup work: ensure the synthetic baseline, generate the real
 * baseline, then run a detection pass. Never throws.
 */
function runStartupTasks() {
  try {
    baselineService.ensureSyntheticBaseline();
  } catch (err) {
    logger.error('surge startup: synthetic baseline failed', { message: err.message });
  }
  try {
    baselineService.generateRealBaseline();
  } catch (err) {
    logger.error('surge startup: real baseline failed', { message: err.message });
  }
  try {
    const result = runDetectionPass();
    logger.info('surge startup detection pass complete', {
      realCreated: result.real.created, demoCreated: result.demo.created,
    });
  } catch (err) {
    logger.error('surge startup: detection pass failed', { message: err.message });
  }
}

/** Aggregate counts for the Module 08 metrics endpoint. */
function surgeMetrics() {
  const db = getDb();
  const c = repo.countByStatus(db);
  return {
    pendingCandidates: Number(c.pending ?? 0),
    confirmedCandidates: Number(c.confirmed ?? 0),
    rejectedCandidates: Number(c.rejected ?? 0),
    staleCandidates: Number(c.stale ?? 0),
    candidatesLast24Hours: Number(c.last24h ?? 0),
    activeSurgeEvents: repo.countActiveEvents(db),
  };
}

module.exports = {
  listCandidates,
  getCandidate,
  listEvents,
  getEvent,
  confirmCandidate,
  rejectCandidate,
  runDetectionPass,
  refreshBaseline,
  runStartupTasks,
  surgeMetrics,
  BASELINE_REFRESH_INTERVAL_MS: config.surge.baselineRefreshIntervalMs,
};
