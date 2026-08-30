'use strict';

/**
 * modules/broadcasts/broadcasts.policy
 *
 * A blood bank may see a request only if a broadcast row links that bank to
 * the request. (The bank's current verification is enforced separately by the
 * requireVerified middleware, so revocation blocks access immediately.)
 */

const repo = require('./broadcasts.repository');

function bankHasBroadcast(bankId, requestId) {
  return repo.existsForBank(bankId, requestId);
}

module.exports = { bankHasBroadcast };
