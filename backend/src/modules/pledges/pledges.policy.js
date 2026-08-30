'use strict';

const { ConflictError, NotFoundError } = require('../../core/errors');
const { PLEDGE_ERROR } = require('./pledges.constants');

const notFound = () => new NotFoundError('Pledge not found.', { code: PLEDGE_ERROR.NOT_FOUND });
const conflict = (message, code = PLEDGE_ERROR.INVALID_STATE) => new ConflictError(message, { code });

function requireOwned(row) {
  if (!row) throw notFound();
  return row;
}

function requireState(row, allowed) {
  if (!allowed.includes(row.status)) throw conflict('The pledge cannot be changed from its current state.');
  return row;
}

module.exports = { notFound, conflict, requireOwned, requireState };
