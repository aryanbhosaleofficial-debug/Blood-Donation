'use strict';

/**
 * core/constants
 *
 * Shared, frozen domain vocabulary. Values here are stable identifiers used
 * across modules, schemas, and (later) the database CHECK constraints.
 */

const API_PREFIX = '/api';

// Session cookie name (deliberately not the express-session default).
const SESSION_COOKIE_NAME = 'blood.sid';

// Header the frontend uses to send the synchronizer CSRF token.
const CSRF_HEADER_NAME = 'x-csrf-token';

// HTTP methods that must never mutate server state (and are CSRF-exempt).
const SAFE_HTTP_METHODS = Object.freeze(['GET', 'HEAD', 'OPTIONS']);

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  HOSPITAL: 'HOSPITAL',
  BLOOD_BANK: 'BLOOD_BANK',
  DONOR: 'DONOR',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

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
  SESSION_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SAFE_HTTP_METHODS,
  ROLES,
  ROLE_VALUES,
  BLOOD_GROUPS,
  COMPONENTS,
  REQUEST_STATUS,
  ALLOCATION_STATUS,
  PLEDGE_STATUS,
  NOTIFICATION_STATUS,
});
