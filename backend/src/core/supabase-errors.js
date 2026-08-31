'use strict';

/**
 * core/supabase-errors
 *
 * Central Supabase/PostgREST -> application-error translation.
 *
 * Repositories call `mapSupabaseError(error, context)` and throw the result.
 * Clients therefore see stable domain error codes (the same ones the SQLite
 * build produced) and never a raw PostgREST payload, SQL text, constraint
 * name, or schema internal.
 *
 * The transactional RPCs raise domain codes directly:
 *     RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NO_STOCK'
 * so for those the PostgREST `message` IS the domain code and is passed
 * through as-is (after an allow-list check).
 */

const {
  AppError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ServiceUnavailableError,
} = require('./errors');

// Domain codes the PL/pgSQL functions may raise. Anything not in this set is
// treated as an unexpected internal error and never echoed to the client.
const DOMAIN_CODES = new Set([
  'INVENTORY_VERSION_CONFLICT', 'INVENTORY_NOT_CONFIGURED', 'INVENTORY_CHANGED',
  'INVENTORY_LIMIT_EXCEEDED', 'INVENTORY_NOT_FOUND',
  'NO_STOCK', 'ALREADY_COVERED', 'BANK_ALREADY_ALLOCATED', 'REQUEST_NOT_OPEN',
  'REQUEST_NOT_FOUND', 'INVALID_ALLOCATION_STATE', 'INVALID_REQUEST_STATE',
  'ALLOCATION_NOT_FOUND', 'COMPLETED_ALLOCATION_EXISTS', 'NOT_COVERED',
  'IDEMPOTENCY_CONFLICT', 'HOSPITAL_PROFILE_REQUIRED', 'ORGANIZATION_NOT_VERIFIED',
  'SLOTS_FULL', 'ALREADY_PLEDGED', 'REQUEST_EXPIRED', 'INVALID_PLEDGE_STATE',
  'DONOR_ALERT_NOT_ACTIONABLE', 'DONOR_ALERT_NOT_FOUND', 'DONOR_PROFILE_NOT_FOUND',
  'PLEDGE_NOT_FOUND', 'PROFILE_NOT_FOUND',
  'INVALID_SURGE_STATE', 'SURGE_CANDIDATE_NOT_FOUND',
  'EXPIRY_INVENTORY_NOT_FOUND', 'EXPIRY_INVENTORY_LIMIT', 'EXPIRY_INVENTORY_CHANGED',
]);

const CONFLICT_CODES = new Set([
  'INVENTORY_VERSION_CONFLICT', 'INVENTORY_CHANGED', 'INVENTORY_LIMIT_EXCEEDED',
  'INVENTORY_NOT_CONFIGURED', 'NO_STOCK', 'ALREADY_COVERED', 'BANK_ALREADY_ALLOCATED',
  'REQUEST_NOT_OPEN', 'INVALID_ALLOCATION_STATE', 'INVALID_REQUEST_STATE',
  'COMPLETED_ALLOCATION_EXISTS', 'NOT_COVERED', 'IDEMPOTENCY_CONFLICT',
  'SLOTS_FULL', 'ALREADY_PLEDGED', 'REQUEST_EXPIRED', 'INVALID_PLEDGE_STATE',
  'DONOR_ALERT_NOT_ACTIONABLE', 'INVALID_SURGE_STATE', 'EXPIRY_INVENTORY_LIMIT',
  'EXPIRY_INVENTORY_CHANGED',
]);

const NOT_FOUND_CODES = new Set([
  'REQUEST_NOT_FOUND', 'ALLOCATION_NOT_FOUND', 'DONOR_ALERT_NOT_FOUND',
  'DONOR_PROFILE_NOT_FOUND', 'PLEDGE_NOT_FOUND', 'PROFILE_NOT_FOUND',
  'SURGE_CANDIDATE_NOT_FOUND', 'INVENTORY_NOT_FOUND', 'EXPIRY_INVENTORY_NOT_FOUND',
]);

const FORBIDDEN_CODES = new Set(['ORGANIZATION_NOT_VERIFIED', 'HOSPITAL_PROFILE_REQUIRED']);

/**
 * @param {object} error  a PostgREST / supabase-js error object
 * @param {{ operation?: string }} [context]
 * @returns {AppError}
 */
function mapSupabaseError(error, context = {}) {
  const raw = (error && (error.message || error.details || error.hint)) || '';
  const code = String(raw).trim();

  if (DOMAIN_CODES.has(code)) {
    if (FORBIDDEN_CODES.has(code)) return new ForbiddenError(code, { code });
    if (NOT_FOUND_CODES.has(code)) return new NotFoundError(code, { code });
    if (CONFLICT_CODES.has(code)) return new ConflictError(code, { code });
    return new ValidationError(code, { code });
  }

  // PostgREST "no rows" from `.single()` — treat as not found, not a 500.
  if (error && (error.code === 'PGRST116' || /no rows/i.test(String(raw)))) {
    return new NotFoundError('Resource not found.', { code: 'NOT_FOUND' });
  }

  // Connectivity / transport problems.
  if (error && (error.code === 'ECONNREFUSED' || /fetch failed|network|timeout/i.test(String(raw)))) {
    return new ServiceUnavailableError('The database is temporarily unavailable.', {
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  // Anything else: do NOT leak PostgREST detail. Log-side keeps the real error.
  const wrapped = new AppError('An unexpected database error occurred.', {
    status: 500,
    code: 'DATABASE_ERROR',
  });
  wrapped.cause = error;
  wrapped.operation = context.operation;
  return wrapped;
}

module.exports = { mapSupabaseError, DOMAIN_CODES };
