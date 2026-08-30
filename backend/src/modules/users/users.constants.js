'use strict';

const { ROLES, ROLE_VALUES } = require('../../core/constants');

/**
 * Normalize an email for storage and lookup: trim + lowercase.
 * @param {unknown} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

module.exports = {
  ROLES,
  ROLE_VALUES,
  normalizeEmail,
};
