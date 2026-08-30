'use strict';

function upsert(db, { donorId, requestId, pledgeId, latitude, longitude, expiresAt }) {
  db.prepare(`INSERT INTO donor_location_sessions
    (donor_id,request_id,pledge_id,latitude,longitude,expires_at)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(pledge_id) DO UPDATE SET
      latitude=excluded.latitude,longitude=excluded.longitude,expires_at=excluded.expires_at,
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .run(donorId, requestId, pledgeId, latitude, longitude, expiresAt);
  return db.prepare('SELECT id,pledge_id,expires_at,created_at,updated_at FROM donor_location_sessions WHERE pledge_id=?').get(pledgeId);
}

function findForPledge(db, pledgeId) {
  return db.prepare('SELECT id,pledge_id,expires_at,created_at,updated_at FROM donor_location_sessions WHERE pledge_id=?').get(pledgeId);
}

function deleteForPledge(db, pledgeId) {
  return db.prepare('DELETE FROM donor_location_sessions WHERE pledge_id=?').run(pledgeId);
}

function deleteForRequest(db, requestId) {
  return db.prepare('DELETE FROM donor_location_sessions WHERE request_id=?').run(requestId);
}

module.exports = { upsert, findForPledge, deleteForPledge, deleteForRequest };
