'use strict';

const { NotFoundError, ConflictError } = require('../../core/errors');
const { ALLOCATION_ERROR, ALLOCATION_STATUS } = require('./allocations.constants');

function inaccessible(message = 'Allocation not found.') {
  return new NotFoundError(message, { code: ALLOCATION_ERROR.NOT_FOUND });
}

function assertOwned(allocation) {
  if (!allocation) throw inaccessible();
  return allocation;
}

function assertReserved(allocation) {
  if (allocation.status !== ALLOCATION_STATUS.RESERVED) {
    throw new ConflictError('The allocation is not in a reservable state for this action.', {
      code: ALLOCATION_ERROR.INVALID_STATE,
    });
  }
}

module.exports = { inaccessible, assertOwned, assertReserved };
