'use strict';

/**
 * integrations/gemini/gemini.sanitizer
 *
 * Two guarantees before anything is sent to Gemini:
 *   1. assertNoForbiddenKeys(obj) — throws GeminiPrivacyError if a disallowed
 *      field name appears anywhere in the object graph.
 *   2. pickAllowed(obj, allowedKeys) — returns a NEW object containing only
 *      the allow-listed keys (deep for plain objects/arrays of primitives).
 *
 * The de-identified operational summary is built with pickAllowed and then
 * re-checked with assertNoForbiddenKeys — belt and braces.
 */

const { FORBIDDEN_INPUT_KEYS } = require('./gemini.constants');
const { GeminiPrivacyError } = require('./gemini.errors');

const FORBIDDEN = new Set(FORBIDDEN_INPUT_KEYS.map((k) => k.toLowerCase()));

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FORBIDDEN_NORMALIZED = new Set([...FORBIDDEN].map(normalizeKey));

/**
 * Recursively assert no forbidden key names appear in `value`.
 * @throws {GeminiPrivacyError}
 */
function assertNoForbiddenKeys(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const norm = normalizeKey(key);
    if (FORBIDDEN.has(key.toLowerCase()) || FORBIDDEN_NORMALIZED.has(norm)) {
      throw new GeminiPrivacyError(key);
    }
    assertNoForbiddenKeys(child, seen);
  }
}

/**
 * Return a new object with only `allowedKeys` copied from `source`.
 * Nested plain objects are passed through as-is (callers keep those shallow
 * and already de-identified); values are JSON round-tripped to drop anything
 * exotic (functions, class instances, Dates -> ISO strings).
 */
function pickAllowed(source, allowedKeys) {
  const allow = new Set(allowedKeys);
  const out = {};
  for (const [key, val] of Object.entries(source || {})) {
    if (allow.has(key) && val !== undefined) {
      out[key] = JSON.parse(JSON.stringify(val));
    }
  }
  return out;
}

module.exports = { assertNoForbiddenKeys, pickAllowed };
