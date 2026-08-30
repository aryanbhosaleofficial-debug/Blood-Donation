'use strict';

const PLEDGE_STATUS = Object.freeze({
  PLEDGED: 'PLEDGED',
  ARRIVED: 'ARRIVED',
  CANCELLED: 'CANCELLED',
  DEFERRED: 'DEFERRED',
  EXPIRED: 'EXPIRED',
  CLOSED: 'CLOSED',
});

const ACTIVE_PLEDGE_STATUSES = Object.freeze([PLEDGE_STATUS.PLEDGED, PLEDGE_STATUS.ARRIVED]);

const PLEDGE_ERROR = Object.freeze({
  NOT_FOUND: 'PLEDGE_NOT_FOUND',
  ALERT_NOT_FOUND: 'DONOR_ALERT_NOT_FOUND',
  ALERT_NOT_ACTIONABLE: 'DONOR_ALERT_NOT_ACTIONABLE',
  ALREADY_PLEDGED: 'ALREADY_PLEDGED',
  SLOTS_FULL: 'SLOTS_FULL',
  REQUEST_NOT_OPEN: 'REQUEST_NOT_OPEN',
  REQUEST_EXPIRED: 'REQUEST_EXPIRED',
  INVALID_STATE: 'INVALID_PLEDGE_STATE',
});

// Coordination capacity only. It is not a medical or transfusable-unit claim.
const pledgeCapacity = (unitsNeeded, backupSlots) => Number(unitsNeeded) + Number(backupSlots || 0);

module.exports = { PLEDGE_STATUS, ACTIVE_PLEDGE_STATUSES, PLEDGE_ERROR, pledgeCapacity };
