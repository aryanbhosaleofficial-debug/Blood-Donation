'use strict';

const config = require('../../core/config');
const { getDb } = require('../../core/database');
const logger = require('../../core/logger');
const pledgesRepo = require('../pledges/pledges.repository');
const policy = require('./locations.policy');
const repo = require('./locations.repository');
const serializer = require('./locations.serializer');

function update(userId, pledgeId, coordinates, now = Date.now()) {
  const transaction = getDb().transaction(() => {
    const pledge = policy.requireShareable(pledgesRepo.findOwnedInDb(getDb(), pledgeId, userId), now);
    const expiresAt = new Date(now + config.locationSessionTtlMinutes * 60 * 1000).toISOString();
    return repo.upsert(getDb(), {
      donorId: pledge.donor_id,
      requestId: pledge.request_id,
      pledgeId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      expiresAt,
    });
  });
  const location = transaction.immediate();
  logger.info('temporary donor location sharing updated', { pledgeId, locationSharing: 'active' });
  return { location: serializer.serializeLocationForDonorSelf(location, now) };
}

function stop(userId, pledgeId) {
  const transaction = getDb().transaction(() => {
    policy.requireOwned(pledgesRepo.findOwnedInDb(getDb(), pledgeId, userId));
    repo.deleteForPledge(getDb(), pledgeId);
  });
  transaction.immediate();
  logger.info('temporary donor location sharing stopped', { pledgeId, locationSharing: 'stopped' });
  return { location: serializer.serializeLocationForDonorSelf(null) };
}

module.exports = { update, stop };
