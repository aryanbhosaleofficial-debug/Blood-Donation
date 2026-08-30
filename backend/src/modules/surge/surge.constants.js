'use strict';

/**
 * modules/surge/surge.constants
 *
 * Module 09 — Surge detection vocabulary.
 *
 * SAFETY: "surge" here means an unusual *blood-demand pattern* inside this
 * platform. It is NOT a disaster, mass-casualty event, epidemic, or clinical
 * emergency, and the detector never asserts an external real-world cause.
 * A candidate always requires ADMIN review before it can become an event.
 */

const SURGE_MODE = Object.freeze({
  REAL: 'REAL',   // analyse only non-synthetic requests + non-synthetic baseline
  DEMO: 'DEMO',   // analyse synthetic scenario requests + synthetic baseline
});

const CANDIDATE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  STALE: 'STALE',
});

const REVIEWABLE_FROM = Object.freeze([CANDIDATE_STATUS.PENDING]);

const EVENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
});

const BASELINE_SOURCE = Object.freeze({
  REAL: 'REAL',
  SYNTHETIC: 'SYNTHETIC',
});

const GEO_SIGNAL = Object.freeze({
  CONCENTRATED: 'CONCENTRATED',
  SPREAD: 'SPREAD',
  UNAVAILABLE: 'UNAVAILABLE',
});

const SIGNAL_LEVEL = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

const SURGE_ERROR = Object.freeze({
  CANDIDATE_NOT_FOUND: 'SURGE_CANDIDATE_NOT_FOUND',
  EVENT_NOT_FOUND: 'SURGE_EVENT_NOT_FOUND',
  INVALID_STATE: 'INVALID_SURGE_STATE',
  INSUFFICIENT_BASELINE: 'SURGE_INSUFFICIENT_BASELINE',
});

// The demo scenario used to prove cold-start anomaly behaviour before enough
// real platform history exists.
const DEMO_SCENARIO_ID = 'DEMO_SURGE_AHMEDABAD_O_NEG';

module.exports = {
  SURGE_MODE,
  CANDIDATE_STATUS,
  REVIEWABLE_FROM,
  EVENT_STATUS,
  BASELINE_SOURCE,
  GEO_SIGNAL,
  SIGNAL_LEVEL,
  SURGE_ERROR,
  DEMO_SCENARIO_ID,
};
