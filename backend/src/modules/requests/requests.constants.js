'use strict';

/**
 * modules/requests/requests.constants
 *
 * Stable error codes and lifecycle rules for emergency requests. Re-exports the
 * shared vocabulary from core/constants so callers have one import.
 */

const {
  REQUEST_STATUS,
  REQUEST_URGENCY,
  REQUEST_URGENCY_VALUES,
  BLOOD_GROUPS,
  COMPONENTS,
} = require('../../core/constants');

const REQUEST_ERROR = Object.freeze({
  NOT_FOUND: 'REQUEST_NOT_FOUND',
  ALREADY_EXISTS: 'REQUEST_ALREADY_EXISTS',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_STATE: 'INVALID_REQUEST_STATE',
  HOSPITAL_PROFILE_REQUIRED: 'HOSPITAL_PROFILE_REQUIRED',
  ACCESS_DENIED: 'REQUEST_ACCESS_DENIED',
});

// Which current states permit each hospital lifecycle action (Module 03 only).
const CANCELABLE_FROM = Object.freeze([REQUEST_STATUS.OPEN]);
const COMPLETABLE_FROM = Object.freeze([REQUEST_STATUS.OPEN]);

// Fields the payload/idempotency comparison treats as the "logical request".
const IDEMPOTENT_FIELDS = Object.freeze(['blood_group', 'component', 'units_needed', 'urgency']);

module.exports = {
  REQUEST_STATUS,
  REQUEST_URGENCY,
  REQUEST_URGENCY_VALUES,
  BLOOD_GROUPS,
  COMPONENTS,
  REQUEST_ERROR,
  CANCELABLE_FROM,
  COMPLETABLE_FROM,
  IDEMPOTENT_FIELDS,
};
