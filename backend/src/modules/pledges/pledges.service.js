'use strict';

const { NotFoundError } = require('../../core/errors');
const logger = require('../../core/logger');
const repo = require('./pledges.repository');
const serializer = require('./pledges.serializer');
const { createPledgeTransactions } = require('./pledges.transaction');
const auditService = require('../audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

function pledgeAudit(userId, action, pledgeId, requestId) {
  auditService.recordAudit({
    actorUserId: userId,
    action,
    entityType: AUDIT_ENTITY.PLEDGE,
    entityId: pledgeId,
    metadata: { requestId },
  });
}

function create(user, alertId) {
  const row = createPledgeTransactions().pledge({ userId: user.id, alertId });
  logger.info('potential donor pledged', { requestId: row.request_id, pledgeId: row.id, publicReference: row.public_reference, status: row.status });
  pledgeAudit(user.id, AUDIT_ACTION.DONOR_PLEDGE_CREATED, row.id, row.request_id);
  return { pledge: serializer.donorView(repo.findOwned(row.id, user.id)) };
}

function listForDonor(user) {
  return { pledges: repo.listForDonor(user.id).map((row) => serializer.donorView(row)) };
}

function getForDonor(user, pledgeId) {
  const row = repo.findOwned(pledgeId, user.id);
  if (!row) throw new NotFoundError('Pledge not found.', { code: 'PLEDGE_NOT_FOUND' });
  return { pledge: serializer.donorView(row) };
}

function cancel(user, pledgeId) {
  createPledgeTransactions().cancel({ userId: user.id, pledgeId });
  logger.info('potential donor pledge cancelled', { pledgeId, status: 'CANCELLED' });
  const result = getForDonor(user, pledgeId);
  pledgeAudit(user.id, AUDIT_ACTION.DONOR_PLEDGE_CANCELLED, Number(pledgeId), result.pledge.request.id);
  return result;
}

function arrive(user, pledgeId) {
  createPledgeTransactions().arrive({ userId: user.id, pledgeId });
  logger.info('potential donor reported arrival', { pledgeId, status: 'ARRIVED' });
  const result = getForDonor(user, pledgeId);
  pledgeAudit(user.id, AUDIT_ACTION.DONOR_PLEDGE_ARRIVED, Number(pledgeId), result.pledge.request.id);
  return result;
}

function listForHospital(user, requestId) {
  const request = repo.hospitalRequest(requestId, user.id);
  if (!request) throw new NotFoundError('Request not found.', { code: 'REQUEST_NOT_FOUND' });
  return serializer.hospitalSummary(request, repo.listForHospital(requestId));
}

module.exports = { create, listForDonor, getForDonor, cancel, arrive, listForHospital };
