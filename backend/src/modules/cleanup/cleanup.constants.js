'use strict';

/**
 * modules/cleanup/cleanup.constants
 *
 * Constants shared across cleanup services.
 */

const EXPIRY_RESTORATION_REASON = 'REQUEST_EXPIRY_RELEASE';

const ACTIVE_REQUEST_STATUSES = Object.freeze(['OPEN', 'COVERED']);
const TERMINAL_REQUEST_STATUSES = Object.freeze(['COMPLETED', 'CANCELLED', 'EXPIRED']);

module.exports = {
  EXPIRY_RESTORATION_REASON,
  ACTIVE_REQUEST_STATUSES,
  TERMINAL_REQUEST_STATUSES,
};
