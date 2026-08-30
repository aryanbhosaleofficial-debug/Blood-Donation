'use strict';

const config = require('../../core/config');
const { getDb } = require('../../core/database');
const { ConflictError, ForbiddenError, NotFoundError } = require('../../core/errors');
const repo = require('./allocations.repository');
const policy = require('./allocations.policy');
const donorAlertsRepo = require('../donor-alerts/donor-alerts.repository');
const {
  ALLOCATION_ERROR, ALLOCATION_STATUS, REQUEST_STATUS, RED_CELLS,
  remainingUnits, reservableUnits,
} = require('./allocations.constants');

const conflict = (message, code) => new ConflictError(message, { code });

function requireCurrentBank(db, userId) {
  const bank = repo.bankForUser(db, userId);
  if (!bank) throw new ForbiddenError('A currently verified blood bank is required.', { code: 'ORGANIZATION_NOT_VERIFIED' });
  return bank;
}

function adjustment(db, inventory, bankId, actorUserId, newUnits, reason) {
  repo.insertAdjustment(db, {
    inventoryId: inventory.id, bankId, actorUserId,
    previousUnits: inventory.units_available, newUnits,
    previousVersion: inventory.version, newVersion: inventory.version + 1, reason,
  });
}

function restore(db, { bankId, actorUserId, requestId, bloodGroup, component, units }) {
  const inventory = repo.inventoryFor(db, bankId, bloodGroup, component);
  if (!inventory) throw conflict('Matching inventory is not configured.', ALLOCATION_ERROR.INVENTORY_NOT_CONFIGURED);
  const newUnits = inventory.units_available + units;
  if (newUnits > config.inventoryMaxUnits) throw conflict('Inventory restoration would exceed the configured limit.', ALLOCATION_ERROR.INVENTORY_LIMIT);
  const changed = repo.restoreInventory(db, inventory.id, bankId, units, actorUserId, config.inventoryMaxUnits);
  if (changed.changes !== 1) throw conflict('Inventory changed during restoration.', ALLOCATION_ERROR.INVENTORY_CHANGED);
  adjustment(db, inventory, bankId, actorUserId, newUnits, `REQUEST_ALLOCATION_RELEASE:${requestId}`);
}

function createAllocationTransactions(db = getDb()) {
  const reserveTransaction = db.transaction(({ userId, requestId }) => {
    const bank = requireCurrentBank(db, userId);
    if (!repo.broadcastExists(db, requestId, bank.id)) throw new NotFoundError('Request not found.', { code: ALLOCATION_ERROR.BROADCAST_NOT_FOUND });
    const request = repo.requestById(db, requestId);
    if (!request) throw new NotFoundError('Request not found.', { code: ALLOCATION_ERROR.BROADCAST_NOT_FOUND });
    if (repo.allocationForBankRequest(db, requestId, bank.id)) throw conflict('This bank has already allocated to the request.', ALLOCATION_ERROR.BANK_ALREADY_ALLOCATED);
    if (request.status === REQUEST_STATUS.COVERED) throw conflict('The request is already covered.', ALLOCATION_ERROR.ALREADY_COVERED);
    if (request.status !== REQUEST_STATUS.OPEN) throw conflict('The request is not open for allocation.', ALLOCATION_ERROR.REQUEST_NOT_OPEN);
    const beforeTotal = repo.activeTotal(db, requestId);
    const remaining = remainingUnits(request.units_needed, beforeTotal);
    if (remaining <= 0) throw conflict('The request is already covered.', ALLOCATION_ERROR.ALREADY_COVERED);
    const inventory = repo.inventoryFor(db, bank.id, request.blood_group, RED_CELLS);
    if (!inventory) throw conflict('Matching inventory is not configured.', ALLOCATION_ERROR.INVENTORY_NOT_CONFIGURED);
    if (inventory.units_available <= 0) throw conflict('No matching stock is available.', ALLOCATION_ERROR.NO_STOCK);
    const quantity = reservableUnits(remaining, inventory.units_available);
    if (quantity <= 0) throw conflict('No matching stock is available.', ALLOCATION_ERROR.NO_STOCK);
    const changed = repo.decrementInventory(db, inventory.id, bank.id, quantity, userId);
    if (changed.changes !== 1) throw conflict('Inventory changed during allocation.', ALLOCATION_ERROR.INVENTORY_CHANGED);
    adjustment(db, inventory, bank.id, userId, inventory.units_available - quantity, `REQUEST_ALLOCATION:${requestId}`);
    let allocation;
    try { allocation = repo.insertAllocation(db, requestId, bank.id, quantity); }
    catch (err) {
      if (err && String(err.code || '').startsWith('SQLITE_CONSTRAINT_UNIQUE')) throw conflict('This bank has already allocated to the request.', ALLOCATION_ERROR.BANK_ALREADY_ALLOCATED);
      throw err;
    }
    const activeAllocated = repo.activeTotal(db, requestId);
    if (activeAllocated >= request.units_needed) {
      repo.setRequestStatus(db, requestId, REQUEST_STATUS.COVERED);
      donorAlertsRepo.closeForRequest(db, requestId);
    }
    return { allocation, request: repo.requestById(db, requestId), inventory: repo.inventoryFor(db, bank.id, request.blood_group, RED_CELLS), activeAllocated };
  });

  const releaseTransaction = db.transaction(({ userId, allocationId }) => {
    const bank = requireCurrentBank(db, userId);
    const allocation = policy.assertOwned(repo.ownedAllocation(db, allocationId, bank.id));
    policy.assertReserved(allocation);
    restore(db, { bankId: bank.id, actorUserId: userId, requestId: allocation.request_id, bloodGroup: allocation.blood_group, component: allocation.component, units: allocation.units_reserved });
    if (repo.setAllocationStatus(db, allocationId, ALLOCATION_STATUS.RELEASED).changes !== 1) throw conflict('The allocation state changed.', ALLOCATION_ERROR.INVALID_STATE);
    const request = repo.requestById(db, allocation.request_id);
    const activeAllocated = repo.activeTotal(db, allocation.request_id);
    if (request.status === REQUEST_STATUS.COVERED && activeAllocated < request.units_needed) repo.setRequestStatus(db, request.id, REQUEST_STATUS.OPEN);
    return { allocation: repo.joinedById(db, allocationId), request: repo.requestById(db, allocation.request_id), activeAllocated };
  });

  const completeTransaction = db.transaction(({ userId, allocationId }) => {
    const bank = requireCurrentBank(db, userId);
    const allocation = policy.assertOwned(repo.ownedAllocation(db, allocationId, bank.id));
    policy.assertReserved(allocation);
    if (repo.setAllocationStatus(db, allocationId, ALLOCATION_STATUS.COMPLETED).changes !== 1) throw conflict('The allocation state changed.', ALLOCATION_ERROR.INVALID_STATE);
    return repo.joinedById(db, allocationId);
  });

  const cancelRequestTransaction = db.transaction(({ hospitalId, actorUserId, requestId }) => {
    const request = repo.requestOwnedByHospital(db, hospitalId, requestId);
    if (!request) throw new NotFoundError('Request not found.', { code: 'REQUEST_NOT_FOUND' });
    if (![REQUEST_STATUS.OPEN, REQUEST_STATUS.COVERED].includes(request.status)) throw conflict('The request cannot be cancelled from its current state.', 'INVALID_REQUEST_STATE');
    if (repo.completedCount(db, requestId) > 0) throw conflict('A completed bank allocation requires manual review before cancellation.', ALLOCATION_ERROR.COMPLETED_ALLOCATION_EXISTS);
    for (const allocation of repo.reservedForRequest(db, requestId)) {
      restore(db, { bankId: allocation.bank_id, actorUserId, requestId, bloodGroup: allocation.blood_group, component: allocation.component, units: allocation.units_reserved });
      if (repo.setAllocationStatus(db, allocation.id, ALLOCATION_STATUS.RELEASED).changes !== 1) throw conflict('An allocation state changed during cancellation.', ALLOCATION_ERROR.INVALID_STATE);
    }
    repo.setRequestStatus(db, requestId, REQUEST_STATUS.CANCELLED, { close: true });
    repo.closeBroadcasts(db, requestId);
    donorAlertsRepo.closeForRequest(db, requestId);
    return repo.requestById(db, requestId);
  });

  return {
    reserve: (input) => reserveTransaction.immediate(input),
    release: (input) => releaseTransaction.immediate(input),
    complete: (input) => completeTransaction.immediate(input),
    cancelRequest: (input) => cancelRequestTransaction.immediate(input),
    modes: Object.freeze({ reserve: 'immediate', release: 'immediate', complete: 'immediate', cancelRequest: 'immediate' }),
  };
}

module.exports = { createAllocationTransactions };
