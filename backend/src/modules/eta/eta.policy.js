'use strict';

const { PLEDGE_STATUS } = require('../pledges/pledges.constants');

function mayCalculate(row, now = Date.now()) {
  const locationExpiry = Date.parse(row.location_expires_at);
  const requestExpiry = Date.parse(row.expires_at);
  return row.request_status === 'OPEN'
    && [PLEDGE_STATUS.PLEDGED, PLEDGE_STATUS.ARRIVED].includes(row.status)
    && Number.isFinite(locationExpiry) && locationExpiry > now
    && Number.isFinite(requestExpiry) && requestExpiry > now
    && Number.isFinite(row.live_latitude) && Number.isFinite(row.live_longitude)
    && Number.isFinite(row.hospital_latitude) && Number.isFinite(row.hospital_longitude);
}

module.exports = { mayCalculate };
