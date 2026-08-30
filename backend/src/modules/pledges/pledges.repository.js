'use strict';

const { getDb } = require('../../core/database');

const DONOR_JOIN = `
  SELECT p.*, r.blood_group, r.component, r.units_needed, r.backup_slots,
         r.urgency, r.status AS request_status, r.expires_at,
         h.name AS hospital_name, h.city AS hospital_city, h.locality AS hospital_locality,
         l.expires_at AS location_expires_at
  FROM donor_pledges p
  JOIN requests r ON r.id=p.request_id
  JOIN hospitals h ON h.id=r.hospital_id
  LEFT JOIN donor_location_sessions l ON l.pledge_id=p.id
`;

function donorForUser(db, userId) {
  return db.prepare(`SELECT d.id FROM donors d JOIN users u ON u.id=d.user_id
    WHERE d.user_id=? AND u.role='DONOR' AND u.is_active=1`).get(userId);
}

function ownedAlert(db, alertId, userId) {
  return db.prepare(`SELECT da.*, d.id AS owned_donor_id, r.status AS request_status,
      r.units_needed, r.backup_slots, r.expires_at
    FROM donor_alerts da
    JOIN donors d ON d.id=da.donor_id
    JOIN users u ON u.id=d.user_id
    JOIN requests r ON r.id=da.request_id
    WHERE da.id=? AND d.user_id=? AND u.is_active=1`).get(alertId, userId);
}

function activeCount(db, requestId) {
  return db.prepare("SELECT COUNT(*) AS count FROM donor_pledges WHERE request_id=? AND status IN ('PLEDGED','ARRIVED')").get(requestId).count;
}

function existingForRequestDonor(db, requestId, donorId) {
  return db.prepare('SELECT * FROM donor_pledges WHERE request_id=? AND donor_id=?').get(requestId, donorId);
}

function referenceExists(db, publicReference) {
  return Boolean(db.prepare('SELECT 1 FROM donor_pledges WHERE public_reference=?').get(publicReference));
}

function insert(db, { requestId, donorId, alertId, publicReference }) {
  const info = db.prepare(`INSERT INTO donor_pledges
    (request_id,donor_id,alert_id,public_reference,status)
    VALUES(?,?,?,?,'PLEDGED')`).run(requestId, donorId, alertId, publicReference);
  return db.prepare('SELECT * FROM donor_pledges WHERE id=?').get(Number(info.lastInsertRowid));
}

function closeAlert(db, alertId) {
  return db.prepare("UPDATE donor_alerts SET status='CLOSED',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN('ACTIVE','VIEWED')").run(alertId);
}

function listForDonor(userId) {
  return getDb().prepare(`${DONOR_JOIN} JOIN donors d ON d.id=p.donor_id WHERE d.user_id=? ORDER BY datetime(p.created_at) DESC,p.id DESC`).all(userId);
}

function findOwned(pledgeId, userId) {
  return getDb().prepare(`${DONOR_JOIN} JOIN donors d ON d.id=p.donor_id WHERE p.id=? AND d.user_id=?`).get(pledgeId, userId);
}

function findOwnedInDb(db, pledgeId, userId) {
  return db.prepare(`SELECT p.*,r.status AS request_status,r.expires_at FROM donor_pledges p
    JOIN donors d ON d.id=p.donor_id JOIN users u ON u.id=d.user_id
    JOIN requests r ON r.id=p.request_id
    WHERE p.id=? AND d.user_id=? AND u.is_active=1`).get(pledgeId, userId);
}

function setCancelled(db, pledgeId) {
  return db.prepare("UPDATE donor_pledges SET status='CANCELLED',cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='PLEDGED'").run(pledgeId);
}

function setArrived(db, pledgeId) {
  return db.prepare("UPDATE donor_pledges SET status='ARRIVED',arrived_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='PLEDGED'").run(pledgeId);
}

function hospitalRequest(requestId, hospitalUserId) {
  return getDb().prepare(`SELECT r.*,h.user_id,h.latitude AS hospital_latitude,h.longitude AS hospital_longitude
    FROM requests r JOIN hospitals h ON h.id=r.hospital_id WHERE r.id=? AND h.user_id=?`).get(requestId, hospitalUserId);
}

function listForHospital(requestId) {
  return getDb().prepare(`SELECT p.id,p.public_reference,p.status,p.pledged_at,p.arrived_at,p.cancelled_at,p.closed_at,
      r.status AS request_status,r.expires_at,
      h.latitude AS hospital_latitude,h.longitude AS hospital_longitude,
      l.latitude AS live_latitude,l.longitude AS live_longitude,l.expires_at AS location_expires_at
    FROM donor_pledges p
    JOIN requests r ON r.id=p.request_id
    JOIN hospitals h ON h.id=r.hospital_id
    LEFT JOIN donor_location_sessions l ON l.pledge_id=p.id
    WHERE p.request_id=? ORDER BY datetime(p.pledged_at),p.id`).all(requestId);
}

function deferForRequest(db, requestId) {
  db.prepare("UPDATE donor_pledges SET status='DEFERRED',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE request_id=? AND status='PLEDGED'").run(requestId);
  db.prepare("UPDATE donor_pledges SET status='CLOSED',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE request_id=? AND status='ARRIVED'").run(requestId);
  return db.prepare('DELETE FROM donor_location_sessions WHERE request_id=?').run(requestId);
}

function closeForRequest(db, requestId) {
  db.prepare("UPDATE donor_pledges SET status='CLOSED',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE request_id=? AND status IN('PLEDGED','ARRIVED','DEFERRED')").run(requestId);
  return db.prepare('DELETE FROM donor_location_sessions WHERE request_id=?').run(requestId);
}

module.exports = {
  donorForUser, ownedAlert, activeCount, existingForRequestDonor, referenceExists,
  insert, closeAlert, listForDonor, findOwned, findOwnedInDb, setCancelled,
  setArrived, hospitalRequest, listForHospital, deferForRequest, closeForRequest,
};
