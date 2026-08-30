'use strict';

const logger = require('../../core/logger');
const { NotFoundError } = require('../../core/errors');
const bloodBanksRepo = require('../blood-banks/blood-banks.repository');
const hospitalsRepo = require('../hospitals/hospitals.repository');
const requestsRepo = require('../requests/requests.repository');
const repo = require('./allocations.repository');
const serializer = require('./allocations.serializer');
const { createAllocationTransactions } = require('./allocations.transaction');
const auditService = require('../audit/audit.service');
const { AUDIT_ACTION, AUDIT_ENTITY } = require('../audit/audit.constants');

function allocate(user, requestId) {
  const outcome = createAllocationTransactions().reserve({ userId: user.id, requestId });
  logger.info('request allocation reserved', { requestId, allocationId: outcome.allocation.id, bankId: outcome.allocation.bank_id, unitsReserved: outcome.allocation.units_reserved });
  auditService.recordAudit({
    actorUserId: user.id,
    action: AUDIT_ACTION.ALLOCATION_RESERVED,
    entityType: AUDIT_ENTITY.ALLOCATION,
    entityId: outcome.allocation.id,
    metadata: { requestId, bankId: outcome.allocation.bank_id, unitsReserved: outcome.allocation.units_reserved },
  });
  return serializer.reservationResult(outcome);
}
function listForBank(user) { const bank=bloodBanksRepo.findByUserId(user.id); return { allocations: bank ? repo.listForBank(bank.id).map(serializer.bankView) : [] }; }
function listForHospitalRequest(user, requestId) { const hospital=hospitalsRepo.findByUserId(user.id); const request=requestsRepo.findById(requestId); if(!hospital||!request||request.hospital_id!==hospital.id) throw new NotFoundError('Request not found.',{code:'REQUEST_NOT_FOUND'}); return { allocations: repo.listForHospitalRequest(hospital.id,requestId).map(serializer.hospitalView) }; }
function release(user,allocationId){const out=createAllocationTransactions().release({userId:user.id,allocationId});logger.info('request allocation released',{requestId:out.request.id,allocationId,bankId:out.allocation.bank_id,unitsReserved:out.allocation.units_reserved});auditService.recordAudit({actorUserId:user.id,action:AUDIT_ACTION.ALLOCATION_RELEASED,entityType:AUDIT_ENTITY.ALLOCATION,entityId:Number(allocationId),metadata:{requestId:out.request.id,bankId:out.allocation.bank_id,unitsReserved:out.allocation.units_reserved}});return{allocation:serializer.bankView(out.allocation),request:{id:out.request.id,status:out.request.status,bankUnitsAllocated:out.activeAllocated,remainingUnits:Math.max(out.request.units_needed-out.activeAllocated,0)}};}
function complete(user,allocationId){const row=createAllocationTransactions().complete({userId:user.id,allocationId});logger.info('request allocation completed',{requestId:row.request_id,allocationId,bankId:row.bank_id,unitsReserved:row.units_reserved});auditService.recordAudit({actorUserId:user.id,action:AUDIT_ACTION.ALLOCATION_COMPLETED,entityType:AUDIT_ENTITY.ALLOCATION,entityId:Number(allocationId),metadata:{requestId:row.request_id,bankId:row.bank_id,unitsReserved:row.units_reserved}});return{allocation:serializer.bankView(row)};}
module.exports={allocate,listForBank,listForHospitalRequest,release,complete};
