'use strict';

/**
 * Create organization users WITH a profile row directly in the disposable test
 * database. Verification is kept consistent the way the Module 02 admin flow
 * keeps it: users.is_verified AND <table>.verified_at move together.
 */

const crypto = require('node:crypto');
const { getDb } = require('../../src/core/database');
const inventoryRepo = require('../../src/modules/inventory/inventory.repository');
const { createTestUser } = require('./users');

const rand = () => crypto.randomBytes(4).toString('hex');

function insertHospitalProfile(userId, { name, registrationReference, city = 'Pune', locality = 'Central', verified }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO hospitals (user_id, name, registration_reference, contact_name, contact_phone, address, city, locality, pin_code)
     VALUES (?, ?, ?, 'Contact', '+91 99999 99999', 'Road', ?, ?, '411001')`,
  ).run(userId, name, registrationReference, city, locality);
  if (verified) {
    db.prepare("UPDATE hospitals SET verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?").run(userId);
  }
  return db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(userId);
}

function insertBankProfile(userId, { name, licenseNo, city = 'Pune', locality = 'Central', verified }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO blood_banks (user_id, name, license_no, contact_name, contact_phone, address, city, locality, pin_code)
     VALUES (?, ?, ?, 'Contact', '9999999999', 'Road', ?, ?, '411001')`,
  ).run(userId, name, licenseNo, city, locality);
  if (verified) {
    db.prepare("UPDATE blood_banks SET verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?").run(userId);
  }
  const row = db.prepare('SELECT * FROM blood_banks WHERE user_id = ?').get(userId);
  // Mirror the Module 02 create flow, which bootstraps 8 red-cell inventory rows.
  inventoryRepo.bootstrap(db, row.id);
  return row;
}

async function createHospital({ email, password, verified = true, active = true, city, locality } = {}) {
  const user = await createTestUser({
    email: email || `hospital_${rand()}@example.com`,
    role: 'HOSPITAL',
    isVerified: verified ? 1 : 0,
    isActive: active ? 1 : 0,
    password,
  });
  const hospital = insertHospitalProfile(user.id, {
    name: `Hospital ${user.id}`,
    registrationReference: `REG-${user.id}-${rand()}`,
    city,
    locality,
    verified,
  });
  return { user, hospital };
}

async function createBank({ email, password, verified = true, active = true } = {}) {
  const user = await createTestUser({
    email: email || `bank_${rand()}@example.com`,
    role: 'BLOOD_BANK',
    isVerified: verified ? 1 : 0,
    isActive: active ? 1 : 0,
    password,
  });
  const bank = insertBankProfile(user.id, {
    name: `Bank ${user.id}`,
    licenseNo: `LIC-${user.id}-${rand()}`,
    verified,
  });
  return { user, bank };
}

async function createDonor({email,password,active=true,bloodGroup='O-',availability='AVAILABLE',availabilityUpdatedAt=new Date().toISOString(),city='Pune',locality='Central',pinCode='411001',approxLatitude=null,approxLongitude=null,nextContactAfter=null,displayName}={}){
  const user=await createTestUser({email:email||`donor_${rand()}@example.com`,password,role:'DONOR',isVerified:0,isActive:active?1:0});
  const info=getDb().prepare(`INSERT INTO donors(user_id,display_name,blood_group,phone_private,email_private,city,locality,pin_code,approx_latitude,approx_longitude,availability_status,availability_updated_at,next_contact_after) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id,displayName||`Donor ${user.id}`,bloodGroup,'9999999999',user.email,city,locality,pinCode,approxLatitude,approxLongitude,availability,availabilityUpdatedAt,nextContactAfter);
  return{user,donor:getDb().prepare('SELECT * FROM donors WHERE id=?').get(Number(info.lastInsertRowid))};
}

/** Simulate an admin verify/revoke: keep users + profile in sync. */
function setVerified(userId, verified) {
  const db = getDb();
  const ts = verified ? new Date().toISOString() : null;
  db.prepare('UPDATE users SET is_verified = ? WHERE id = ?').run(verified ? 1 : 0, userId);
  db.prepare('UPDATE hospitals SET verified_at = ? WHERE user_id = ?').run(ts, userId);
  db.prepare('UPDATE blood_banks SET verified_at = ? WHERE user_id = ?').run(ts, userId);
}

function setActive(userId, active) {
  getDb().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active ? 1 : 0, userId);
}

/** A valid POST /api/requests body. */
function requestPayload(overrides = {}) {
  return {
    clientRequestId: crypto.randomUUID(),
    bloodGroup: 'O-',
    component: 'RED_CELLS',
    unitsNeeded: 2,
    urgency: 'CRITICAL',
    note: 'Emergency requirement',
    ...overrides,
  };
}

module.exports = { createHospital, createBank, createDonor, setVerified, setActive, requestPayload, rand };
