'use strict';

const { ConflictError, NotFoundError } = require('../../core/errors');
const { PLEDGE_STATUS, PLEDGE_ERROR } = require('../pledges/pledges.constants');

function requireOwned(pledge) {
  if (!pledge) throw new NotFoundError('Pledge not found.', { code: PLEDGE_ERROR.NOT_FOUND });
  return pledge;
}

function requireShareable(pledge, now = Date.now()) {
  requireOwned(pledge);
  if (![PLEDGE_STATUS.PLEDGED, PLEDGE_STATUS.ARRIVED].includes(pledge.status)) {
    throw new ConflictError('Location sharing requires an active pledge.', { code: PLEDGE_ERROR.INVALID_STATE });
  }
  if (pledge.request_status !== 'OPEN') {
    throw new ConflictError('The request is no longer open.', { code: PLEDGE_ERROR.REQUEST_NOT_OPEN });
  }
  if (Number.isFinite(Date.parse(pledge.expires_at)) && Date.parse(pledge.expires_at) <= now) {
    throw new ConflictError('The request has expired.', { code: PLEDGE_ERROR.REQUEST_EXPIRED });
  }
  return pledge;
}

module.exports = { requireOwned, requireShareable };
