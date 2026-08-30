'use strict';

/**
 * modules/auth/auth.constants
 */

module.exports = Object.freeze({
  // Single generic message for every credential failure (anti-enumeration).
  INVALID_CREDENTIALS_CODE: 'INVALID_CREDENTIALS',
  INVALID_CREDENTIALS_MESSAGE: 'Invalid email or password',

  ACCOUNT_INACTIVE_CODE: 'ACCOUNT_INACTIVE',
  ACCOUNT_INACTIVE_MESSAGE: 'This account has been disabled.',
});
