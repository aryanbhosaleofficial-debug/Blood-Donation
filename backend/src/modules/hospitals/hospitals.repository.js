'use strict';
const { getDb } = require('../../core/database');
const SELECT = `SELECT h.*, u.is_verified FROM hospitals h JOIN users u ON u.id=h.user_id`;
function findByUserId(userId) { return getDb().prepare(`${SELECT} WHERE h.user_id=?`).get(userId); }
function insert(userId, d) {
  const info = getDb().prepare(`INSERT INTO hospitals
    (user_id,name,registration_reference,contact_name,contact_phone,address,city,locality,pin_code,latitude,longitude)
    VALUES (@userId,@name,@registrationReference,@contactName,@contactPhone,@address,@city,@locality,@pinCode,@latitude,@longitude)`).run({userId,...d});
  return findByUserId(userId);
}
const MAP = { name:'name', registrationReference:'registration_reference', contactName:'contact_name', contactPhone:'contact_phone', address:'address', city:'city', locality:'locality', pinCode:'pin_code', latitude:'latitude', longitude:'longitude' };
function update(userId, d) {
  const entries = Object.entries(d).filter(([k]) => MAP[k]);
  const sets = entries.map(([k]) => `${MAP[k]}=@${k}`).join(', ');
  getDb().prepare(`UPDATE hospitals SET ${sets} WHERE user_id=@userId`).run({userId,...d});
  return findByUserId(userId);
}
module.exports = { findByUserId, insert, update };
