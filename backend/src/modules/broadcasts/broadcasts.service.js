'use strict';

/**
 * modules/broadcasts/broadcasts.service
 *
 * Broadcast creation runs inside the request-creation transaction (same db
 * handle) so a request that should be broadcast is never left with a partial
 * set of rows. Zero eligible banks is a legitimate result - it produces zero
 * rows and does not abort the request.
 *
 * Also serves the blood-bank incoming-request views: a bank only ever sees a
 * request that a broadcast row links it to (join through request_broadcasts).
 */

const { NotFoundError } = require('../../core/errors');
const bloodBanksRepo = require('../blood-banks/blood-banks.repository');
const requestsRepo = require('../requests/requests.repository');
const requestsSerializer = require('../requests/requests.serializer');
const repo = require('./broadcasts.repository');
const serializer = require('./broadcasts.serializer');

/**
 * Insert one PENDING broadcast row per currently-eligible blood bank.
 * @param {import('better-sqlite3').Database} db - the active transaction handle
 * @param {number} requestId
 * @returns {number} number of broadcast rows created
 */
function createForRequest(db, requestId) {
  const bankIds = repo.eligibleBankIds(db);
  for (const bankId of bankIds) {
    repo.insert(db, requestId, bankId);
  }
  return bankIds.length;
}

/** Close all still-open broadcast rows for a request (cancel / complete). */
function closeForRequest(db, requestId) {
  return repo.closeForRequest(db, requestId).changes;
}

function summaryForRequest(requestId) {
  return serializer.summary(repo.listForRequest(requestId));
}

/** OPEN requests broadcast to the authenticated bank (deterministic order). */
function listIncomingForBank(sessionUser) {
  const bank = bloodBanksRepo.findByUserId(sessionUser.id);
  if (!bank) return { requests: [] };
  return {
    requests: requestsRepo.listForBank(bank.id, 'OPEN').map((r) => requestsSerializer.bankView(r)),
  };
}

/** One incoming request detail for the bank - only if it was broadcast to them. */
function getIncomingForBank(sessionUser, requestId) {
  const bank = bloodBanksRepo.findByUserId(sessionUser.id);
  const row = bank ? requestsRepo.findForBankById(bank.id, requestId) : null;
  if (!row) {
    throw new NotFoundError('Request not found.', { code: 'REQUEST_NOT_FOUND' });
  }
  return { request: requestsSerializer.bankView(row) };
}

module.exports = {
  createForRequest,
  closeForRequest,
  summaryForRequest,
  listIncomingForBank,
  getIncomingForBank,
};
