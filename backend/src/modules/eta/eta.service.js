'use strict';

const config = require('../../core/config');
const { haversineDistanceKm } = require('../matching/distance.service');
const { ETA_BANDS, DISTANCE_BANDS } = require('./eta.constants');

function bandFor(value, bands) {
  if (!Number.isFinite(value) || value < 0) return null;
  return bands.find((band) => value <= band.max).label;
}

const etaBand = (minutes) => bandFor(minutes, ETA_BANDS);
const distanceBand = (kilometres) => bandFor(kilometres, DISTANCE_BANDS);

function estimateTravel({ donorLatitude, donorLongitude, hospitalLatitude, hospitalLongitude }, assumptions = config) {
  const straightLineKm = haversineDistanceKm(donorLatitude, donorLongitude, hospitalLatitude, hospitalLongitude);
  const estimatedRoadKm = straightLineKm * assumptions.etaRoadFactor;
  const etaMinutes = (estimatedRoadKm / assumptions.etaAssumedSpeedKmh) * 60 + assumptions.etaPrepBufferMinutes;
  return { straightLineKm, estimatedRoadKm, etaMinutes };
}

module.exports = { bandFor, etaBand, distanceBand, estimateTravel };
