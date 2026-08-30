'use strict';

/**
 * modules/surge/surge.transaction
 *
 * Atomic ADMIN review actions for surge candidates.
 *
 * Confirm (PENDING -> CONFIRMED):
 *   BEGIN
 *     re-read candidate; require status = PENDING (else 409 INVALID_SURGE_STATE)
 *     candidate -> CONFIRMED (+ reviewer, reviewed_at, review_note)
 *     create surge_event (ACTIVE)             — one per candidate (UNIQUE)
 *     queue SURGE_CONFIRMED notifications for active ADMINs (outbox)
 *     write SURGE_CANDIDATE_CONFIRMED audit row (admin actor)
 *   COMMIT
 *
 * Reject (PENDING -> REJECTED):
 *   BEGIN
 *     re-read candidate; require status = PENDING
 *     candidate -> REJECTED (+ reviewer, reviewed_at, review_note)
 *     write SURGE_CANDIDATE_REJECTED audit row (admin actor)
 *   COMMIT
 *
 * A confirmed surge is an INTERNAL operational blood-demand state only. It
 * never asserts an external cause and never triggers any public broadcast.
 */

const { getDb } = require('../../core/database');
const { NotFoundError, ConflictError } = require('../../core/errors');
const { ROLES } = require('../../core/constants');
const usersRepo = require('../users/users.repository');
const { queueNotification } = require('../notifications/notifications.outbox');
const {
  buildSurgeConfirmedNotification,
  buildSurgeRejectedNotification,
} = require('../notifications/notification-builders');
const auditRepo = require('../audit/audit.repository');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

const repo = require('./surge.repository');
const { CANDIDATE_STATUS, SURGE_ERROR } = require('./surge.constants');

function notFound() {
  return new NotFoundError('Surge candidate not found.', { code: SURGE_ERROR.CANDIDATE_NOT_FOUND });
}

function invalidState(current) {
  return new ConflictError(
    `The surge candidate cannot be reviewed from its current state (${current}).`,
    { code: SURGE_ERROR.INVALID_STATE },
  );
}

function createSurgeReviewTransactions(db = getDb()) {
  const confirm = db.transaction(({ candidateId, adminId, note }) => {
    const candidate = repo.findCandidateById(db, candidateId);
    if (!candidate) throw notFound();
    if (candidate.status !== CANDIDATE_STATUS.PENDING) throw invalidState(candidate.status);

    const changed = repo.setCandidateReviewed(db, {
      id: candidateId, status: CANDIDATE_STATUS.CONFIRMED, reviewerId: adminId, note,
    });
    if (changed.changes !== 1) throw invalidState(candidate.status);

    const summary = `Unusual ${candidate.blood_group} ${candidate.component} demand in ${candidate.city}: `
      + `${candidate.observed_request_count} requests observed vs ~${candidate.expected_lambda.toFixed(2)} expected `
      + `(p=${candidate.poisson_tail_probability}).`;

    const event = repo.insertEvent(db, {
      candidateId,
      city: candidate.city,
      bloodGroup: candidate.blood_group,
      component: candidate.component,
      confirmedByUserId: adminId,
      summary,
      adminNote: note ?? null,
      isSynthetic: candidate.is_synthetic,
    });

    const admins = usersRepo.listActiveByRole(ROLES.ADMIN, db);
    for (const admin of admins) {
      queueNotification(db, {
        recipientUserId: admin.id,
        ...buildSurgeConfirmedNotification({
          candidateId, eventId: event.id,
          city: candidate.city, bloodGroup: candidate.blood_group, component: candidate.component,
          recipientUserId: admin.id,
        }),
      });
    }

    auditRepo.insert(db, {
      actorUserId: adminId,
      action: AUDIT_ACTION.SURGE_CANDIDATE_CONFIRMED,
      entityType: AUDIT_ENTITY.SURGE_CANDIDATE,
      entityId: candidateId,
      metadata: {
        eventId: event.id,
        city: candidate.city,
        bloodGroup: candidate.blood_group,
        component: candidate.component,
        observed: candidate.observed_request_count,
        expectedLambda: candidate.expected_lambda,
        poissonTailProbability: candidate.poisson_tail_probability,
        signalScore: candidate.signal_score,
        statusFrom: 'PENDING',
        statusTo: 'CONFIRMED',
      },
    });

    return { candidate: repo.findCandidateById(db, candidateId), event };
  });

  const reject = db.transaction(({ candidateId, adminId, note }) => {
    const candidate = repo.findCandidateById(db, candidateId);
    if (!candidate) throw notFound();
    if (candidate.status !== CANDIDATE_STATUS.PENDING) throw invalidState(candidate.status);

    const changed = repo.setCandidateReviewed(db, {
      id: candidateId, status: CANDIDATE_STATUS.REJECTED, reviewerId: adminId, note,
    });
    if (changed.changes !== 1) throw invalidState(candidate.status);

    const admins = usersRepo.listActiveByRole(ROLES.ADMIN, db);
    for (const admin of admins) {
      queueNotification(db, {
        recipientUserId: admin.id,
        ...buildSurgeRejectedNotification({
          candidateId,
          city: candidate.city, bloodGroup: candidate.blood_group, component: candidate.component,
          recipientUserId: admin.id,
        }),
      });
    }

    auditRepo.insert(db, {
      actorUserId: adminId,
      action: AUDIT_ACTION.SURGE_CANDIDATE_REJECTED,
      entityType: AUDIT_ENTITY.SURGE_CANDIDATE,
      entityId: candidateId,
      metadata: {
        city: candidate.city,
        bloodGroup: candidate.blood_group,
        component: candidate.component,
        statusFrom: 'PENDING',
        statusTo: 'REJECTED',
      },
    });

    return { candidate: repo.findCandidateById(db, candidateId) };
  });

  return {
    confirm: (input) => confirm.immediate(input),
    reject: (input) => reject.immediate(input),
  };
}

module.exports = { createSurgeReviewTransactions };
