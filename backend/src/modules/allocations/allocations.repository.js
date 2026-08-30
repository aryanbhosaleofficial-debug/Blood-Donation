'use strict';

const { getDb } = require('../../core/database');

const JOINED = `
  SELECT a.*, b.name AS bank_name,
         r.blood_group, r.component, r.units_needed, r.urgency,
         r.status AS request_status, h.name AS hospital_name
    FROM request_allocations a
    JOIN blood_banks b ON b.id = a.bank_id
    JOIN requests r ON r.id = a.request_id
    JOIN hospitals h ON h.id = r.hospital_id
`;

function bankForUser(db, userId) {
  return db.prepare(`SELECT b.id, b.user_id, b.name
    FROM blood_banks b JOIN users u ON u.id=b.user_id
    WHERE b.user_id=? AND u.role='BLOOD_BANK' AND u.is_active=1 AND u.is_verified=1`).get(userId);
}
function broadcastExists(db, requestId, bankId) { return Boolean(db.prepare('SELECT 1 FROM request_broadcasts WHERE request_id=? AND bank_id=?').get(requestId, bankId)); }
function requestById(db, id) { return db.prepare('SELECT * FROM requests WHERE id=?').get(id); }
function allocationForBankRequest(db, requestId, bankId) { return db.prepare('SELECT * FROM request_allocations WHERE request_id=? AND bank_id=?').get(requestId, bankId); }
function activeTotal(db, requestId) { return db.prepare("SELECT COALESCE(SUM(units_reserved),0) AS n FROM request_allocations WHERE request_id=? AND status IN ('RESERVED','COMPLETED')").get(requestId).n; }
function inventoryFor(db, bankId, bloodGroup, component) { return db.prepare('SELECT * FROM inventory WHERE bank_id=? AND blood_group=? AND component=?').get(bankId,bloodGroup,component); }
function decrementInventory(db, inventoryId, bankId, quantity, actorId) { return db.prepare(`UPDATE inventory SET units_available=units_available-?,version=version+1,updated_by_user_id=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND bank_id=? AND units_available>=?`).run(quantity,actorId,inventoryId,bankId,quantity); }
function restoreInventory(db, inventoryId, bankId, quantity, actorId, maxUnits) { return db.prepare(`UPDATE inventory SET units_available=units_available+?,version=version+1,updated_by_user_id=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND bank_id=? AND units_available+?<=?`).run(quantity,actorId,inventoryId,bankId,quantity,maxUnits); }
function insertAdjustment(db,d){return db.prepare(`INSERT INTO inventory_adjustments(inventory_id,bank_id,actor_user_id,previous_units,new_units,previous_version,new_version,reason) VALUES(@inventoryId,@bankId,@actorUserId,@previousUnits,@newUnits,@previousVersion,@newVersion,@reason)`).run(d);}
function insertAllocation(db, requestId, bankId, units) { const info=db.prepare("INSERT INTO request_allocations(request_id,bank_id,units_reserved,status) VALUES(?,?,?,'RESERVED')").run(requestId,bankId,units);return db.prepare('SELECT * FROM request_allocations WHERE id=?').get(Number(info.lastInsertRowid)); }
function ownedAllocation(db, allocationId, bankId) { return db.prepare('SELECT a.*,r.blood_group,r.component,r.units_needed,r.status request_status FROM request_allocations a JOIN requests r ON r.id=a.request_id WHERE a.id=? AND a.bank_id=?').get(allocationId,bankId); }
function setAllocationStatus(db,id,status){const column=status==='RELEASED'?'released_at':'completed_at';return db.prepare(`UPDATE request_allocations SET status=?,${column}=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='RESERVED'`).run(status,id);}
function setRequestStatus(db,id,status,{close=false}={}){return db.prepare(`UPDATE requests SET status=?,closed_at=${close?"strftime('%Y-%m-%dT%H:%M:%fZ','now')":'NULL'} WHERE id=?`).run(status,id);}
function joinedById(db,id){return db.prepare(`${JOINED} WHERE a.id=?`).get(id);}
function listForBank(bankId){return getDb().prepare(`${JOINED} WHERE a.bank_id=? ORDER BY datetime(a.created_at) DESC,a.id DESC`).all(bankId);}
function listForHospitalRequest(hospitalId,requestId){return getDb().prepare(`${JOINED} WHERE r.hospital_id=? AND r.id=? ORDER BY a.id`).all(hospitalId,requestId);}
function requestOwnedByHospital(db,hospitalId,requestId){return db.prepare('SELECT * FROM requests WHERE id=? AND hospital_id=?').get(requestId,hospitalId);}
function reservedForRequest(db,requestId){return db.prepare("SELECT a.*,r.blood_group,r.component FROM request_allocations a JOIN requests r ON r.id=a.request_id WHERE a.request_id=? AND a.status='RESERVED'").all(requestId);}
function completedCount(db,requestId){return db.prepare("SELECT COUNT(*) n FROM request_allocations WHERE request_id=? AND status='COMPLETED'").get(requestId).n;}
function closeBroadcasts(db,requestId){return db.prepare("UPDATE request_broadcasts SET status='CLOSED',responded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE request_id=? AND status<>'CLOSED'").run(requestId);}

/** Resolve hospital user_id for a request (needed for notification recipients). */
function hospitalUserIdForRequest(db, requestId) {
  const row = db.prepare('SELECT h.user_id FROM requests r JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=?').get(requestId);
  return row ? row.user_id : null;
}

module.exports={bankForUser,broadcastExists,requestById,allocationForBankRequest,activeTotal,inventoryFor,decrementInventory,restoreInventory,insertAdjustment,insertAllocation,ownedAllocation,setAllocationStatus,setRequestStatus,joinedById,listForBank,listForHospitalRequest,requestOwnedByHospital,reservedForRequest,completedCount,closeBroadcasts,hospitalUserIdForRequest};
