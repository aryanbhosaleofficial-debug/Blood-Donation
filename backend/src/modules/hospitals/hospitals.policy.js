'use strict';
const { ConflictError } = require('../../core/errors');
function assertIdentityEditable(row, changes) {
  if (!row.is_verified) return;
  if ((changes.name !== undefined && changes.name !== row.name) ||
      (changes.registrationReference !== undefined && changes.registrationReference !== row.registration_reference)) {
    throw new ConflictError('Revoke verification before changing organization identity.', { code: 'REVERIFICATION_REQUIRED' });
  }
}
module.exports = { assertIdentityEditable };
