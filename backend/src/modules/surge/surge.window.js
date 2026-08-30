'use strict';

/**
 * modules/surge/surge.window
 *
 * Deterministic analysis-window + time-bucket helpers.
 *
 * Strategy (documented, see docs/architecture.md):
 *   - The ANALYSIS window is ROLLING and ends "now", so a spike that just
 *     happened is seen immediately:
 *       windowEnd   = now
 *       windowStart = now - analysisWindowMinutes
 *     The immediately-preceding equal-sized window is used for the velocity
 *     signal.
 *   - The DEDUPE bucket is a FIXED grid of `analysisWindowMinutes` in UTC:
 *       bucketId = floor(nowMs / windowMs)
 *     Repeated detector ticks inside the same grid slot produce the same
 *     dedupe_key → at most one candidate per (mode, city, group, component,
 *     bucket). The next grid slot with a continued anomaly can raise a new
 *     candidate.
 *
 * All DB timestamps stay UTC ISO strings. Local-hour conversion for baseline
 * lookup uses the configured IANA timezone explicitly.
 */

/**
 * Local hour (0–23) of an instant in a given IANA timezone.
 * @param {Date|string|number} when
 * @param {string} timeZone  IANA name, e.g. 'Asia/Kolkata'
 * @returns {number}
 */
function localHour(when, timeZone) {
  const date = when instanceof Date ? when : new Date(when);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  let hour = Number(hourPart ? hourPart.value : NaN);
  if (hour === 24) hour = 0; // some engines render midnight as '24'
  return hour;
}

/**
 * @param {number} nowMs
 * @param {number} windowMinutes
 * @returns {{
 *   nowMs: number,
 *   windowMs: number,
 *   startMs: number, endMs: number,
 *   startIso: string, endIso: string,
 *   prevStartMs: number, prevEndMs: number,
 *   prevStartIso: string, prevEndIso: string,
 *   bucketId: number, bucketStartIso: string
 * }}
 */
function computeWindow(nowMs, windowMinutes) {
  const windowMs = windowMinutes * 60 * 1000;
  const endMs = nowMs;
  const startMs = endMs - windowMs;
  const prevEndMs = startMs;
  const prevStartMs = prevEndMs - windowMs;
  const bucketId = Math.floor(nowMs / windowMs);
  return {
    nowMs,
    windowMs,
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    prevStartMs,
    prevEndMs,
    prevStartIso: new Date(prevStartMs).toISOString(),
    prevEndIso: new Date(prevEndMs).toISOString(),
    bucketId,
    bucketStartIso: new Date(bucketId * windowMs).toISOString(),
  };
}

/**
 * Deterministic dedupe key for a candidate group + time bucket.
 * @param {object} p
 * @param {string} p.mode
 * @param {string} p.city
 * @param {string} p.bloodGroup
 * @param {string} p.component
 * @param {number} p.bucketId
 * @returns {string}
 */
function dedupeKey({ mode, city, bloodGroup, component, bucketId }) {
  const normCity = String(city).trim().toUpperCase();
  return `${mode}:${normCity}:${bloodGroup}:${component}:${bucketId}`;
}

module.exports = { localHour, computeWindow, dedupeKey };
