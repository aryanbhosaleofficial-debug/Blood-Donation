'use strict';

const config = require('../../core/config');
const { ConflictError, NotFoundError } = require('../../core/errors');
const { compatibleDonorGroups } = require('./compatibility');
const { filterAndRankPotentialDonors } = require('./donor-filter.service');
const repo = require('./matching.repository');
const alertsRepo = require('../donor-alerts/donor-alerts.repository');
const serializer = require('./matching.serializer');
const { getDb } = require('../../core/database');
const logger = require('../../core/logger');
const { queueNotification } = require('../notifications/notifications.outbox');
const builders = require('../notifications/notification-builders');
const auditService = require('../audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

function activatePotentialDonorFallback(user, requestId, now = Date.now()) {
  const request = repo.ownedOpenRequest(requestId, user.id);
  if (!request) throw new NotFoundError('Request not found.', { code: 'REQUEST_NOT_FOUND' });
  const remaining = Math.max(request.units_needed - request.bank_units_allocated, 0);
  if (request.status !== 'OPEN' || remaining <= 0)
    throw new ConflictError('Potential donor fallback is not required for this request.', { code: 'DONOR_FALLBACK_NOT_REQUIRED' });

  const groups = compatibleDonorGroups(request.component, request.blood_group);
  const cutoff = new Date(now - config.availabilityFreshnessDays * 86400000).toISOString();
  const rows = repo.candidatesForRequest(requestId, groups, cutoff, new Date(now).toISOString(), config.donorMatchLimit * 20);
  const hospital = { city: request.h_city, locality: request.h_locality, pin_code: request.h_pin_code, latitude: request.h_latitude, longitude: request.h_longitude };
  const selected = filterAndRankPotentialDonors(rows, hospital, config.donorMatchLimit);

  const write = getDb().transaction(() => {
    const current = repo.ownedOpenRequest(requestId, user.id);
    const currentRemaining = current ? Math.max(current.units_needed - current.bank_units_allocated, 0) : 0;
    if (!current) throw new NotFoundError('Request not found.', { code: 'REQUEST_NOT_FOUND' });
    if (current.status !== 'OPEN' || currentRemaining <= 0)
      throw new ConflictError('Potential donor fallback is not required for this request.', { code: 'DONOR_FALLBACK_NOT_REQUIRED' });

    let created = 0;
    const alertedDonors = []; // { alertId, donorUserId }
    for (const item of selected) {
      const result = alertsRepo.assignOrReactivate(getDb(), requestId, item.row.id);
      if (result.changes > 0) {
        created += 1;
        alertedDonors.push({ donorUserId: item.row.user_id });
      }
    }

    // Queue DONOR_ALERT_CREATED notifications for newly assigned donors (inside transaction)
    for (const { donorUserId } of alertedDonors) {
      queueNotification(getDb(), {
        recipientUserId: donorUserId,
        ...builders.buildDonorAlertNotification({
          alertId: null, // alert id not easily available from assignOrReactivate result
          bloodGroup: request.blood_group,
          component: request.component,
          urgency: request.urgency,
          hospitalName: request.h_city ? request.h_city : 'hospital',
          city: request.h_city ?? '',
          locality: request.h_locality ?? null,
          expiresAt: request.expires_at ?? null,
        }),
        dedupeKey: `DONOR_ALERT_CREATED:req=${requestId}:donorUser=${donorUserId}`,
      });
    }

    return { created, total: alertsRepo.countActionable(getDb(), requestId) };
  });

  const result = write.immediate();
  logger.info('potential donor fallback activated', { requestId, candidateCount: selected.length, newAlertCount: result.created });
  auditService.recordAudit({
    actorUserId: user.id,
    action: AUDIT_ACTION.DONOR_FALLBACK_ACTIVATED,
    entityType: AUDIT_ENTITY.REQUEST,
    entityId: requestId,
    metadata: { newAlertCount: result.created, actionableAlertCount: result.total },
  });
  if (result.created > 0) {
    auditService.recordAudit({
      actorUserId: user.id,
      action: AUDIT_ACTION.DONOR_ALERT_CREATED,
      entityType: AUDIT_ENTITY.REQUEST,
      entityId: requestId,
      metadata: { alertCount: result.created },
    });
  }
  return serializer.hospitalFallbackResult(requestId, result.created, result.total);
}

module.exports = { activatePotentialDonorFallback };
