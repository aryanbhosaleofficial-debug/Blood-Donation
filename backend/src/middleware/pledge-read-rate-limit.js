'use strict';

const config = require('../core/config');
const { TooManyRequestsError } = require('../core/errors');

const WINDOW_MS = 60 * 1000;
const LIMIT = Math.max(10, Math.ceil(WINDOW_MS / config.pollIntervalMs) * 3);
const windows = new Map();

// Authenticated hospital/request keying avoids penalising shared campus IPs.
function pledgeReadRateLimit(req, res, next) {
  const now = Date.now();
  const key = `${req.user.id}:${req.params.requestId}`;
  let state = windows.get(key);
  if (!state || now - state.startedAt >= WINDOW_MS) state = { startedAt: now, count: 0 };
  state.count += 1;
  windows.set(key, state);
  if (windows.size > 10000) {
    for (const [candidate, value] of windows) if (now - value.startedAt >= WINDOW_MS) windows.delete(candidate);
  }
  if (state.count > LIMIT) return next(new TooManyRequestsError('Pledge status is being refreshed too frequently.', { code: 'PLEDGE_READ_RATE_LIMITED' }));
  return next();
}

module.exports = { pledgeReadRateLimit, WINDOW_MS, LIMIT };
