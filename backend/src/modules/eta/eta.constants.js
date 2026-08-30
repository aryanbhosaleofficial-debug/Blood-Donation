'use strict';

const ETA_BANDS = Object.freeze([
  Object.freeze({ max: 10, label: '0–10 min' }),
  Object.freeze({ max: 20, label: '10–20 min' }),
  Object.freeze({ max: 30, label: '20–30 min' }),
  Object.freeze({ max: 45, label: '30–45 min' }),
  Object.freeze({ max: 60, label: '45–60 min' }),
  Object.freeze({ max: Infinity, label: '60+ min' }),
]);

const DISTANCE_BANDS = Object.freeze([
  Object.freeze({ max: 5, label: '0–5 km' }),
  Object.freeze({ max: 10, label: '5–10 km' }),
  Object.freeze({ max: 20, label: '10–20 km' }),
  Object.freeze({ max: 30, label: '20–30 km' }),
  Object.freeze({ max: Infinity, label: '30+ km' }),
]);

module.exports = { ETA_BANDS, DISTANCE_BANDS };
