'use strict';

const { estimateTravel, etaBand, distanceBand } = require('./eta.service');
const { mayCalculate } = require('./eta.policy');

function serializeBands(row, now = Date.now()) {
  if (!mayCalculate(row, now)) {
    return { etaBand: null, distanceBand: null, etaStatus: 'UNAVAILABLE' };
  }
  const estimate = estimateTravel({
    donorLatitude: row.live_latitude,
    donorLongitude: row.live_longitude,
    hospitalLatitude: row.hospital_latitude,
    hospitalLongitude: row.hospital_longitude,
  });
  return {
    etaBand: etaBand(estimate.etaMinutes),
    distanceBand: distanceBand(estimate.straightLineKm),
    etaStatus: 'AVAILABLE',
  };
}

module.exports = { serializeBands };
