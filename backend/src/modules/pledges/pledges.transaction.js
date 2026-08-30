'use strict';

const crypto = require('node:crypto');
const { getDb } = require('../../core/database');
const { ConflictError, NotFoundError } = require('../../core/errors');
const repo = require('./pledges.repository');
const locationsRepo = require('../locations/locations.repository');
const { PLEDGE_STATUS, PLEDGE_ERROR, pledgeCapacity } = require('./pledges.constants');
const { queueNotification } = require('../notifications/notifications.outbox');
const builders = require('../notifications/notification-builders');

const conflict = (message, code) => new ConflictError(message, { code });
const pastExpiry = (value, now) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;

function createReference(db) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const value = `PDG-${crypto.randomBytes(5).toString('hex').slice(0, 8).toUpperCase()}`;
    if (!repo.referenceExists(db, value)) return value;
  }
  throw new Error('Unable to generate a unique pledge reference');
}

function createPledgeTransactions(db = getDb()) {
  /** Fetch hospital user_id for a request (needed for notification recipient). */
  function hospitalUserIdForRequest(requestId) {
    const row = db.prepare('SELECT h.user_id FROM requests r JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=?').get(requestId);
    return row ? row.user_id : null;
  }

  /** Fetch hospital context (name, city) for pledge notifications. */
  function hospitalContextForRequest(requestId) {
    return db.prepare('SELECT h.name, h.city FROM requests r JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=?').get(requestId) ?? {};
  }

  const pledgeTransaction = db.transaction(({ userId, alertId, now = Date.now() }) => {
    const donor = repo.donorForUser(db, userId);
    if (!donor) throw new NotFoundError('Donor profile not found.', { code: 'DONOR_PROFILE_NOT_FOUND' });
    const alert = repo.ownedAlert(db, alertId, userId);
    if (!alert) throw new NotFoundError('Donor alert not found.', { code: PLEDGE_ERROR.ALERT_NOT_FOUND });
    if (repo.existingForRequestDonor(db, alert.request_id, donor.id)) {
      throw conflict('You have already pledged for this request.', PLEDGE_ERROR.ALREADY_PLEDGED);
    }
    if (!['ACTIVE', 'VIEWED'].includes(alert.status)) {
      throw conflict('This donor alert is no longer actionable.', PLEDGE_ERROR.ALERT_NOT_ACTIONABLE);
    }
    if (alert.request_status !== 'OPEN') {
      throw conflict('The request is not open for donor pledges.', PLEDGE_ERROR.REQUEST_NOT_OPEN);
    }
    if (pastExpiry(alert.expires_at, now)) {
      throw conflict('The request has expired.', PLEDGE_ERROR.REQUEST_EXPIRED);
    }
    const capacity = pledgeCapacity(alert.units_needed, alert.backup_slots);
    if (repo.activeCount(db, alert.request_id) >= capacity) {
      throw conflict('Enough potential donors have already responded to this request.', PLEDGE_ERROR.SLOTS_FULL);
    }
    let pledge;
    try {
      pledge = repo.insert(db, {
        requestId: alert.request_id,
        donorId: donor.id,
        alertId,
        publicReference: createReference(db),
      });
    } catch (err) {
      if (err && String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
        throw conflict('You have already pledged for this request.', PLEDGE_ERROR.ALREADY_PLEDGED);
      }
      throw err;
    }
    if (repo.closeAlert(db, alertId).changes !== 1) {
      throw conflict('This donor alert changed while pledging.', PLEDGE_ERROR.ALERT_NOT_ACTIONABLE);
    }
    // Notify donor: pledge confirmation
    const hospitalCtx = hospitalContextForRequest(alert.request_id);
    queueNotification(db, {
      recipientUserId: userId,
      ...builders.buildPledgeConfirmedForDonorNotification({
        pledgeId: pledge.id,
        requestId: alert.request_id,
        hospitalName: hospitalCtx.name ?? 'the hospital',
        city: hospitalCtx.city ?? '',
      }),
    });
    // Notify hospital: new pledge (using public_reference only — no donor identity)
    const hospitalUserId = hospitalUserIdForRequest(alert.request_id);
    if (hospitalUserId) {
      queueNotification(db, {
        recipientUserId: hospitalUserId,
        ...builders.buildPledgeCreatedForHospitalNotification({
          pledgeId: pledge.id,
          requestId: alert.request_id,
          publicReference: pledge.public_reference,
        }),
      });
    }
    return pledge;
  });

  const cancelTransaction = db.transaction(({ userId, pledgeId }) => {
    const pledge = repo.findOwnedInDb(db, pledgeId, userId);
    if (!pledge) throw new NotFoundError('Pledge not found.', { code: PLEDGE_ERROR.NOT_FOUND });
    if (pledge.status !== PLEDGE_STATUS.PLEDGED) {
      throw conflict('Only a pledged response can be cancelled.', PLEDGE_ERROR.INVALID_STATE);
    }
    if (repo.setCancelled(db, pledgeId).changes !== 1) {
      throw conflict('The pledge state changed.', PLEDGE_ERROR.INVALID_STATE);
    }
    locationsRepo.deleteForPledge(db, pledgeId);
    // Notify hospital: pledge cancelled (using public_reference only)
    const hospitalUserId = hospitalUserIdForRequest(pledge.request_id);
    if (hospitalUserId) {
      queueNotification(db, {
        recipientUserId: hospitalUserId,
        ...builders.buildPledgeCancelledForHospitalNotification({
          pledgeId,
          requestId: pledge.request_id,
          publicReference: pledge.public_reference,
        }),
      });
    }
    return pledgeId;
  });

  const arriveTransaction = db.transaction(({ userId, pledgeId, now = Date.now() }) => {
    const pledge = repo.findOwnedInDb(db, pledgeId, userId);
    if (!pledge) throw new NotFoundError('Pledge not found.', { code: PLEDGE_ERROR.NOT_FOUND });
    if (pledge.status !== PLEDGE_STATUS.PLEDGED) {
      throw conflict('Only a pledged response can be marked arrived.', PLEDGE_ERROR.INVALID_STATE);
    }
    if (pledge.request_status !== 'OPEN') {
      throw conflict('The request is no longer open.', PLEDGE_ERROR.REQUEST_NOT_OPEN);
    }
    if (pastExpiry(pledge.expires_at, now)) {
      throw conflict('The request has expired.', PLEDGE_ERROR.REQUEST_EXPIRED);
    }
    if (repo.setArrived(db, pledgeId).changes !== 1) {
      throw conflict('The pledge state changed.', PLEDGE_ERROR.INVALID_STATE);
    }
    // Notify hospital: donor arrived (using public_reference only)
    const hospitalUserId = hospitalUserIdForRequest(pledge.request_id);
    if (hospitalUserId) {
      queueNotification(db, {
        recipientUserId: hospitalUserId,
        ...builders.buildPledgeArrivedForHospitalNotification({
          pledgeId,
          requestId: pledge.request_id,
          publicReference: pledge.public_reference,
        }),
      });
    }
    return pledgeId;
  });

  return {
    pledge: (input) => pledgeTransaction.immediate(input),
    cancel: (input) => cancelTransaction.immediate(input),
    arrive: (input) => arriveTransaction.immediate(input),
    modes: Object.freeze({ pledge: 'immediate', cancel: 'immediate', arrive: 'immediate' }),
  };
}

module.exports = { createPledgeTransactions, createReference, pastExpiry };
