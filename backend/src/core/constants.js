'use strict';

/**
 * core/constants
 *
 * Shared, frozen domain vocabulary. Values here are stable identifiers used
 * across modules, schemas, and (later) the database CHECK constraints.
 */

const API_PREFIX = '/api';

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  HOSPITAL: 'HOSPITAL',
  BLOOD_BANK: 'BLOOD_BANK',
  DONOR: 'DONOR',
});

const BLOOD_GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

// MVP donor matching is red-cells only (see docs/development-rules.md Rule D2).
const COMPONENTS = Object.freeze({
  RED_CELLS: 'RED_CELLS',
});

const REQUEST_STATUS = Object.freeze({
  OPEN: 'OPEN',
  COVERED: 'COVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const ALLOCATION_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  RELEASED: 'RELEASED',
  COMPLETED: 'COMPLETED',
});

const PLEDGE_STATUS = Object.freeze({
  PLEDGED: 'PLEDGED',
  ARRIVED: 'ARRIVED',
  CANCELLED: 'CANCELLED',
  DEFERRED: 'DEFERRED',
  EXPIRED: 'EXPIRED',
});

const NOTIFICATION_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  FAILED: 'FAILED',
});

module.exports = Object.freeze({
  API_PREFIX,
  ROLES,
  BLOOD_GROUPS,
  COMPONENTS,
  REQUEST_STATUS,
  ALLOCATION_STATUS,
  PLEDGE_STATUS,
  NOTIFICATION_STATUS,
});
