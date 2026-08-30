'use strict';

/**
 * modules/requests/requests.policy
 *
 * Ownership / access rules for emergency requests.
 *
 *   HOSPITAL   -> only requests belonging to its own hospital profile
 *   BLOOD_BANK -> only requests it was broadcast (checked via request_broadcasts)
 *   ADMIN      -> read-only oversight of all requests
 *   DONOR      -> no access in Module 03
 *
 * Denied access surfaces as 404 REQUEST_NOT_FOUND so request ids cannot be
 * enumerated.
 */

const { NotFoundError, ForbiddenError, ConflictError } = require('../../core/errors');
const { ROLES } = require('../../core/constants');
const hospitalsRepo = require('../hospitals/hospitals.repository');
const bloodBanksRepo = require('../blood-banks/blood-banks.repository');
const broadcastsPolicy = require('../broadcasts/broadcasts.policy');
const { REQUEST_ERROR } = require('./requests.constants');

function requestNotFound() {
  return new NotFoundError('Request not found.', { code: REQUEST_ERROR.NOT_FOUND });
}

/** The hospital profile for a hospital user, or 409 HOSPITAL_PROFILE_REQUIRED. */
function resolveHospitalProfile(userId) {
  const hospital = hospitalsRepo.findByUserId(userId);
  if (!hospital) {
    throw new ConflictError('A hospital profile is required before creating requests.', {
      code: REQUEST_ERROR.HOSPITAL_PROFILE_REQUIRED,
    });
  }
  return hospital;
}

/** The blood-bank profile for a bank user, or 409 (profile inconsistency). */
function resolveBankProfile(userId) {
  const bank = bloodBanksRepo.findByUserId(userId);
  if (!bank) {
    throw new ConflictError('A blood-bank profile is required.', { code: 'BANK_PROFILE_REQUIRED' });
  }
  return bank;
}

/**
 * Assert the session user may READ this request. Used by GET /api/requests/:id
 * (HOSPITAL owner or ADMIN).
 */
function assertHospitalOrAdminCanView(sessionUser, requestRow) {
  if (!requestRow) throw requestNotFound();
  if (sessionUser.role === ROLES.ADMIN) return;
  if (sessionUser.role === ROLES.HOSPITAL) {
    const hospital = hospitalsRepo.findByUserId(sessionUser.id);
    if (hospital && requestRow.hospital_id === hospital.id) return;
    throw requestNotFound();
  }
  throw requestNotFound();
}

/** Assert the hospital user owns this request (mutations). */
function assertHospitalOwnership(sessionUser, requestRow) {
  if (!requestRow) throw requestNotFound();
  const hospital = hospitalsRepo.findByUserId(sessionUser.id);
  if (!hospital || requestRow.hospital_id !== hospital.id) {
    throw requestNotFound();
  }
  return hospital;
}

/** Assert a bank may read a request (a broadcast row must link them). */
function assertBankCanView(bankId, requestRow) {
  if (!requestRow || !broadcastsPolicy.bankHasBroadcast(bankId, requestRow.id)) {
    throw requestNotFound();
  }
}

/** Assert a lifecycle transition is allowed from the current state. */
function assertTransitionAllowed(currentStatus, allowedFrom) {
  if (!allowedFrom.includes(currentStatus)) {
    throw new ConflictError(`Request cannot change from ${currentStatus}.`, {
      code: REQUEST_ERROR.INVALID_STATE,
    });
  }
}

module.exports = {
  requestNotFound,
  resolveHospitalProfile,
  resolveBankProfile,
  assertHospitalOrAdminCanView,
  assertHospitalOwnership,
  assertBankCanView,
  assertTransitionAllowed,
  ForbiddenError,
};
