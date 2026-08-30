'use strict';

/**
 * modules/audit/audit.sanitizer
 *
 * Defensive privacy guard for audit metadata.
 *
 * Policy (08.36 / 08.37 / Test Group AH):
 *   - Audit metadata is ALWAYS explicitly constructed by the calling module.
 *   - This sanitizer is a second line of defence: if a forbidden key ever
 *     reaches recordAudit(), the key AND its value are dropped entirely (not
 *     stored) and a warning is logged. Secrets and exact donor coordinates
 *     never persist — not even the key name.
 *   - Request notes / patient-identifying free text must not be copied into
 *     metadata by callers; there is no automatic note field.
 *
 * Forbidden (case-insensitive substring match on the KEY name):
 *   password, passwd, pwd, hash, secret, csrf, token, session, cookie,
 *   authorization, bearer, latitude, longitude, phone, email
 *   plus the exact keys: lat, lng, lon, coordinates, coords
 */

const logger = require('../../core/logger');

const FORBIDDEN_SUBSTRINGS = Object.freeze([
  'password', 'passwd', 'pwd', 'hash', 'secret', 'csrf', 'token',
  'session', 'cookie', 'authorization', 'bearer', 'latitude', 'longitude',
  'phone', 'email',
]);

const FORBIDDEN_EXACT = Object.freeze(['lat', 'lng', 'lon', 'coordinates', 'coords']);

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/**
 * @param {string} key
 * @returns {boolean} true when the key name is not allowed in audit metadata
 */
function isForbiddenKey(key) {
  const lower = String(key).toLowerCase();
  if (FORBIDDEN_EXACT.includes(lower)) return true;
  return FORBIDDEN_SUBSTRINGS.some((frag) => lower.includes(frag));
}

/**
 * Recursively copy an object, dropping any forbidden key (and its value)
 * entirely. Returns a NEW structure; the input is not mutated.
 *
 * @param {*} value
 * @param {number} [depth]
 * @returns {{ clean: *, redactedKeys: string[] }}
 */
function sanitizeMetadata(value, depth = 0) {
  const redactedKeys = [];

  function walk(node, level) {
    if (level > MAX_DEPTH) return null;
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, level + 1));
    }
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (isForbiddenKey(k)) {
          redactedKeys.push(k);
        } else {
          out[k] = walk(v, level + 1);
        }
      }
      return out;
    }
    return node;
  }

  const clean = walk(value ?? {}, depth);
  return { clean: clean ?? {}, redactedKeys };
}

/**
 * Sanitize metadata for storage and log a warning if anything was redacted.
 *
 * @param {object} metadata
 * @param {object} [ctx] - { action, entityType } for the warning log
 * @returns {object} safe metadata object
 */
function safeMetadata(metadata, ctx = {}) {
  const { clean, redactedKeys } = sanitizeMetadata(metadata);
  if (redactedKeys.length > 0) {
    logger.warn('audit metadata contained forbidden keys — redacted', {
      action: ctx.action,
      entityType: ctx.entityType,
      redactedKeys,
    });
  }
  return clean;
}

/**
 * Strict check used by tests / development: throws when a forbidden key exists.
 * @param {object} metadata
 */
function assertSafeMetadata(metadata) {
  const { redactedKeys } = sanitizeMetadata(metadata);
  if (redactedKeys.length > 0) {
    throw new Error(`audit metadata contains forbidden keys: ${redactedKeys.join(', ')}`);
  }
}

module.exports = { isForbiddenKey, sanitizeMetadata, safeMetadata, assertSafeMetadata, REDACTED };
