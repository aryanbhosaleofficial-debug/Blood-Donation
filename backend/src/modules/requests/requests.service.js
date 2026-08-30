'use strict';

/**
 * modules/requests/requests.service
 *
 * Emergency-request business rules: idempotent creation (+ transactional
 * broadcast fan-out), listing, detail, and the OPEN -> CANCELLED / COMPLETED
 * lifecycle.
 */

const config = require('../../core/config');
const logger = require('../../core/logger');
const { getDb } = require('../../core/database');
const { ConflictError } = require('../../core/errors');
const hospitalsRepo = require('../hospitals/hospitals.repository');
const broadcastsService = require('../broadcasts/broadcasts.service');
const broadcastsRepo = require('../broadcasts/broadcasts.repository');
const repo = require('./requests.repository');
const policy = require('./requests.policy');
const serializer = require('./requests.serializer');
const { createAllocationTransactions } = require('../allocations/allocations.transaction');
const {
  REQUEST_ERROR,
  REQUEST_STATUS,
  COMPLETABLE_FROM,
} = require('./requests.constants');

function computeExpiry(fromMs = Date.now()) {
  return new Date(fromMs + config.requestTtlMinutes * 60 * 1000).toISOString();
}

function payloadMatches(row, input) {
  return (
    row.blood_group === input.bloodGroup &&
    row.component === input.component &&
    row.units_needed === input.unitsNeeded &&
    row.urgency === input.urgency
  );
}

function idempotencyConflict() {
  return new ConflictError('This clientRequestId was already used with different request details.', {
    code: REQUEST_ERROR.IDEMPOTENCY_CONFLICT,
  });
}

/**
 * Create an emergency request for the authenticated verified hospital.
 * Idempotent on (hospital, clientRequestId): a matching replay returns the
 * existing request; a conflicting replay is a 409.
 */
function create(sessionUser, input) {
  const hospital = policy.resolveHospitalProfile(sessionUser.id);

  const outcome = getDb().transaction(() => {
    const existing = repo.findByClientId(getDb(), hospital.id, input.clientRequestId);
    if (existing) {
      if (!payloadMatches(existing, input)) throw idempotencyConflict();
      return { row: existing, broadcastCount: broadcastsRepo.countForRequest(existing.id), replay: true };
    }

    let row;
    try {
      row = repo.insert(getDb(), {
        clientRequestId: input.clientRequestId,
        hospitalId: hospital.id,
        bloodGroup: input.bloodGroup,
        component: input.component,
        unitsNeeded: input.unitsNeeded,
        backupSlots: config.requestBackupSlotsDefault,
        urgency: input.urgency,
        note: input.note ?? null,
        isSynthetic: false, // never hospital-controlled
        scenarioId: null,
        expiresAt: computeExpiry(),
      });
    } catch (err) {
      // Cross-process race on the UNIQUE(hospital_id, client_request_id) index.
      if (err && String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
        const raced = repo.findByClientId(getDb(), hospital.id, input.clientRequestId);
        if (raced && payloadMatches(raced, input)) {
          return { row: raced, broadcastCount: broadcastsRepo.countForRequest(raced.id), replay: true };
        }
        throw idempotencyConflict();
      }
      throw err;
    }

    // Broadcast fan-out inside the same transaction: a DB failure here rolls the
    // whole request back. Zero eligible banks is fine (0 rows, still commits).
    const broadcastCount = broadcastsService.createForRequest(getDb(), row.id);
    return { row, broadcastCount, replay: false };
  })();

  logger.info('emergency request created', {
    requestId: outcome.row.id,
    hospitalId: hospital.id,
    status: outcome.row.status,
    urgency: outcome.row.urgency,
    unitsNeeded: outcome.row.units_needed,
    broadcastCount: outcome.broadcastCount,
    idempotentReplay: outcome.replay,
  });

  return {
    request: serializer.hospitalView(outcome.row),
    broadcast: { bankCount: outcome.broadcastCount },
    idempotentReplay: outcome.replay,
  };
}

function listForHospital(sessionUser, status) {
  const hospital = hospitalsRepo.findByUserId(sessionUser.id);
  if (!hospital) return { requests: [] };
  return { requests: repo.listByHospital(hospital.id, status).map((r) => serializer.hospitalView(r)) };
}

function listForAdmin(status) {
  return { requests: repo.listAll(status).map((r) => serializer.hospitalView(r)) };
}

function getOne(sessionUser, requestId) {
  const row = repo.findById(requestId);
  policy.assertHospitalOrAdminCanView(sessionUser, row);
  return {
    request: serializer.hospitalView(row),
    broadcast: broadcastsService.summaryForRequest(row.id),
  };
}

function transition(sessionUser, requestId, targetStatus, allowedFrom) {
  const transaction = getDb().transaction(() => {
    const row = repo.findById(requestId);
    policy.assertHospitalOwnership(sessionUser, row);
    policy.assertTransitionAllowed(row.status, allowedFrom);
    const next = repo.close(getDb(), requestId, targetStatus);
    broadcastsService.closeForRequest(getDb(), requestId);
    return next;
  });
  const updated = transaction.immediate();

  logger.info('emergency request closed', {
    requestId: updated.id,
    hospitalId: updated.hospital_id,
    status: updated.status,
  });
  return { request: serializer.hospitalView(updated) };
}

function cancel(sessionUser, requestId) {
  const hospital = policy.resolveHospitalProfile(sessionUser.id);
  const updated = createAllocationTransactions().cancelRequest({ hospitalId: hospital.id, actorUserId: sessionUser.id, requestId });
  return { request: serializer.hospitalView(updated) };
}

function complete(sessionUser, requestId) {
  const row = repo.findById(requestId);
  policy.assertHospitalOwnership(sessionUser, row);
  if (row.status === REQUEST_STATUS.OPEN) {
    throw new ConflictError('The request must be covered before it can be completed.', { code: REQUEST_ERROR.NOT_COVERED });
  }
  return transition(sessionUser, requestId, REQUEST_STATUS.COMPLETED, COMPLETABLE_FROM);
}

module.exports = { create, listForHospital, listForAdmin, getOne, cancel, complete, computeExpiry };
