'use strict';

/**
 * modules/surge/surge-signals.service
 *
 * Supporting (non-statistical) evidence for a surge candidate. Every signal is
 * simple and explainable — no black-box model.
 *
 *   distinctHospitals   – how many different hospitals are driving demand
 *   velocity            – recent window count vs the immediately preceding one
 *   geographic          – are the requesting hospital facilities concentrated
 *                         within SURGE_GEO_RADIUS_KM (facility coords only,
 *                         never donor coordinates)
 *   inventory           – recorded matching red-cell stock, fresh vs stale
 *                         rows, and recorded depletion during the window
 *
 * A `signalScore` in 0–100 is derived for RANKING ONLY. It is not a
 * probability of a disaster.
 */

const config = require('../../core/config');
const { haversineDistanceKm } = require('../matching/distance.service');
const { GEO_SIGNAL, SIGNAL_LEVEL } = require('./surge.constants');

/**
 * @param {number} currentCount
 * @param {number} previousCount
 * @returns {number} bounded ratio (previous 0 → treated as 1)
 */
function velocityRatio(currentCount, previousCount) {
  const denom = previousCount > 0 ? previousCount : 1;
  const ratio = currentCount / denom;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(Math.round(ratio * 100) / 100, 99);
}

/**
 * Geographic concentration of requesting hospital facilities.
 * @param {Array<{latitude:number|null, longitude:number|null}>} hospitals
 * @returns {{ signal: string, radiusKm: number|null, located: number, total: number }}
 */
function geographicSignal(hospitals) {
  const located = hospitals.filter((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude));
  if (located.length < 2) {
    return { signal: GEO_SIGNAL.UNAVAILABLE, radiusKm: null, located: located.length, total: hospitals.length };
  }
  const centroid = {
    lat: located.reduce((s, h) => s + h.latitude, 0) / located.length,
    lon: located.reduce((s, h) => s + h.longitude, 0) / located.length,
  };
  let maxKm = 0;
  for (const h of located) {
    const d = haversineDistanceKm(centroid.lat, centroid.lon, h.latitude, h.longitude);
    if (d > maxKm) maxKm = d;
  }
  const radiusKm = Math.round(maxKm * 10) / 10;
  return {
    signal: radiusKm <= config.surge.geoRadiusKm ? GEO_SIGNAL.CONCENTRATED : GEO_SIGNAL.SPREAD,
    radiusKm,
    located: located.length,
    total: hospitals.length,
  };
}

/**
 * Inventory evidence from recorded matching stock rows.
 * @param {Array<{unitsAvailable:number, updatedAt:string}>} rows
 * @param {number} depletionUnits
 * @param {number} [nowMs]
 */
function inventorySignal(rows, depletionUnits, nowMs = Date.now()) {
  const staleThreshold = nowMs - config.inventoryStaleMinutes * 60 * 1000;
  let fresh = 0;
  let stale = 0;
  let recordedUnits = 0;
  for (const row of rows) {
    const isFresh = Date.parse(row.updatedAt) >= staleThreshold;
    if (isFresh) {
      fresh += 1;
      recordedUnits += Number(row.unitsAvailable) || 0;
    } else {
      stale += 1;
    }
  }
  return {
    recordedUnits,          // recorded units among FRESH rows only
    freshRows: fresh,
    staleRows: stale,
    depletionUnits: Math.max(0, Math.round(depletionUnits) || 0),
  };
}

/**
 * Derive a 0–100 ranking score + level from all evidence.
 * Weights are explicit and documented:
 *   statistical  up to 60  (from -log10(pTail), capped)
 *   distinct     up to 15  (>= configured threshold gives full weight)
 *   velocity     up to 10  (ratio >= 3 gives full weight)
 *   geographic   10        (CONCENTRATED)
 *   depletion    5         (any recorded depletion of matching stock)
 */
function computeScore({ pTail, observed, distinctHospitals, velocity, geographic, inventory }) {
  let score = 0;

  if (Number.isFinite(pTail) && pTail > 0) {
    const magnitude = Math.min(-Math.log10(pTail), 6); // pTail 1e-6 → 6
    score += (magnitude / 6) * 60;
  } else if (Number.isFinite(pTail) && pTail === 0) {
    score += 60;
  }

  const distinctFull = config.surge.minDistinctHospitals;
  score += Math.min(distinctHospitals / Math.max(distinctFull, 1), 1) * 15;

  score += Math.min(Math.max(velocity - 1, 0) / 2, 1) * 10; // velocity 3 → full

  if (geographic === GEO_SIGNAL.CONCENTRATED) score += 10;

  if (inventory && inventory.depletionUnits > 0) score += 5;

  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  let level = SIGNAL_LEVEL.LOW;
  if (rounded >= config.surge.scoreConfirmationHint) level = SIGNAL_LEVEL.HIGH;
  else if (rounded >= 40) level = SIGNAL_LEVEL.MEDIUM;

  return { score: rounded, level, observedForContext: observed };
}

module.exports = { velocityRatio, geographicSignal, inventorySignal, computeScore };
