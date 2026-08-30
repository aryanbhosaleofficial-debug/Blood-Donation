'use strict';
const repo = require('./donors.repository');
const policy = require('./donors.policy');
const ser = require('./donors.serializer');
const auditService = require('../audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

const normalize = (d) => ({
  ...d,
  phone: d.phone ?? null,
  email: d.email ?? null,
  locality: d.locality ?? null,
  pinCode: d.pinCode ?? null,
  approxLatitude: d.approxLatitude ?? null,
  approxLongitude: d.approxLongitude ?? null,
  lastDonationDate: d.lastDonationDate ?? null,
  nextContactAfter: d.nextContactAfter ?? null,
});

function create(userId, d) {
  if (repo.findByUserId(userId)) throw policy.duplicate();
  try {
    const row = repo.insert(userId, normalize(d));
    auditService.recordAudit({
      actorUserId: userId,
      action: AUDIT_ACTION.DONOR_PROFILE_CREATED,
      entityType: AUDIT_ENTITY.DONOR,
      entityId: row.id,
      metadata: { bloodGroup: row.blood_group, city: row.city },
    });
    return ser.serializeDonorForSelf(row);
  } catch (e) {
    if (e && String(e.code || '').startsWith('SQLITE_CONSTRAINT_UNIQUE')) throw policy.duplicate();
    throw e;
  }
}

function get(userId) {
  return ser.serializeDonorForSelf(policy.requireProfile(repo.findByUserId(userId)));
}

function update(userId, d) {
  const existing = policy.requireProfile(repo.findByUserId(userId));
  const row = repo.update(userId, d);
  auditService.recordAudit({
    actorUserId: userId,
    action: AUDIT_ACTION.DONOR_PROFILE_UPDATED,
    entityType: AUDIT_ENTITY.DONOR,
    entityId: existing.id,
    metadata: { bloodGroup: row.blood_group, city: row.city },
  });
  return ser.serializeDonorForSelf(row);
}

function availability(userId, status) {
  const existing = policy.requireProfile(repo.findByUserId(userId));
  const row = repo.setAvailability(userId, status);
  auditService.recordAudit({
    actorUserId: userId,
    action: AUDIT_ACTION.DONOR_AVAILABILITY_CHANGED,
    entityType: AUDIT_ENTITY.DONOR,
    entityId: existing.id,
    metadata: { availabilityFrom: existing.availability_status, availabilityTo: row.availability_status },
  });
  return ser.serializeDonorForSelf(row);
}

module.exports = { create, get, update, availability };
