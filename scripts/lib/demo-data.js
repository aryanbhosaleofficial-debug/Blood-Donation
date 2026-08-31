'use strict';

/**
 * scripts/lib/demo-data
 *
 * The single source of truth for the deterministic local demo environment.
 *
 * DEMO ONLY — every account here uses `config.demoPassword` and an
 * `@example.test` address. Nothing in this file is a production credential or
 * a real person's contact information. Physical blood-bank stock is NOT
 * represented — the inventory numbers are demo values chosen to exercise
 * partial / multi-bank allocation and coverage.
 */

const bcrypt = require('bcrypt');
const config = require('../../backend/src/core/config');
const { assertPasswordPolicy } = require('../../backend/src/security/password');
const inventoryRepo = require('../../backend/src/modules/inventory/inventory.repository');
const baselineService = require('../../backend/src/modules/surge/baseline.service');

const nowIso = () => new Date().toISOString();

// ── Account catalogue ────────────────────────────────────────────────────

const ADMIN = { email: 'admin.demo@example.test', role: 'ADMIN' };

const HOSPITAL = {
  email: 'hospital.demo@example.test',
  role: 'HOSPITAL',
  profile: {
    name: 'Demo General Hospital',
    registration_reference: 'DEMO-HOSP-0001',
    contact_name: 'Demo Hospital Desk',
    contact_phone: '+91 90000 00001',
    address: '1 Demo Road',
    city: 'Pune',
    locality: 'Shivajinagar',
    pin_code: '411005',
    latitude: 18.5308,
    longitude: 73.8475,
  },
};

const BANKS = [
  {
    email: 'bank1.demo@example.test',
    profile: { name: 'Demo Blood Bank North', license_no: 'DEMO-BANK-0001', city: 'Pune', locality: 'Shivajinagar', pin_code: '411005', latitude: 18.5350, longitude: 73.8500 },
    inventory: { 'O-': 1, 'O+': 2, 'A+': 3 },
  },
  {
    email: 'bank2.demo@example.test',
    profile: { name: 'Demo Blood Bank Central', license_no: 'DEMO-BANK-0002', city: 'Pune', locality: 'Camp', pin_code: '411001', latitude: 18.5100, longitude: 73.8800 },
    inventory: { 'O-': 1, 'B+': 2 },
  },
  {
    email: 'bank3.demo@example.test',
    profile: { name: 'Demo Blood Bank South', license_no: 'DEMO-BANK-0003', city: 'Pune', locality: 'Kothrud', pin_code: '411038', latitude: 18.5074, longitude: 73.8077 },
    inventory: { 'O-': 2, 'AB+': 1 },
  },
];

// Blood groups chosen so the O- fallback demo has compatible (O-) donors.
const DONORS = [
  { email: 'donor1.demo@example.test', bloodGroup: 'O-', availability: 'AVAILABLE' },
  { email: 'donor2.demo@example.test', bloodGroup: 'O-', availability: 'AVAILABLE' },
  { email: 'donor3.demo@example.test', bloodGroup: 'O+', availability: 'AVAILABLE' },
  { email: 'donor4.demo@example.test', bloodGroup: 'A+', availability: 'AVAILABLE' },
  { email: 'donor5.demo@example.test', bloodGroup: 'B+', availability: 'UNKNOWN' },
];

// Surge DEMO scenario (Ahmedabad / O- / RED_CELLS) — matches the synthetic
// baseline ensured at startup. Requests are injected with created_at = now by
// injectSurgeScenario() so a candidate is fresh for the demo.
const SURGE_CITY = 'Ahmedabad';
const SURGE_HOSPITALS = [
  { email: 'surge.hospital1.demo@example.test', profile: { name: 'Demo Surge Hospital 1', registration_reference: 'DEMO-SURGE-H1', city: SURGE_CITY, locality: 'Navrangpura', pin_code: '380009', latitude: 23.0300, longitude: 72.5700 } },
  { email: 'surge.hospital2.demo@example.test', profile: { name: 'Demo Surge Hospital 2', registration_reference: 'DEMO-SURGE-H2', city: SURGE_CITY, locality: 'Paldi', pin_code: '380007', latitude: 23.0120, longitude: 72.5600 } },
  { email: 'surge.hospital3.demo@example.test', profile: { name: 'Demo Surge Hospital 3', registration_reference: 'DEMO-SURGE-H3', city: SURGE_CITY, locality: 'Vastrapur', pin_code: '380015', latitude: 23.0390, longitude: 72.5290 } },
];
const SURGE_REQUEST_COUNT = 8;

// ── Low-level upserts (idempotent) ──────────────────────────────────────

function upsertUser(db, { email, role, passwordHash, isVerified }) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE users SET role = ?, password_hash = ?, is_verified = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(role, passwordHash, isVerified ? 1 : 0, existing.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  }
  const info = db.prepare('INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES (?, ?, ?, ?, 1)')
    .run(email, passwordHash, role, isVerified ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
}

function upsertHospital(db, userId, p, { verified }) {
  const existing = db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(userId);
  const verifiedAt = verified ? nowIso() : null;
  if (existing) {
    db.prepare(`UPDATE hospitals SET name=@name, registration_reference=@registration_reference,
      contact_name=@contact_name, contact_phone=@contact_phone, address=@address, city=@city,
      locality=@locality, pin_code=@pin_code, latitude=@latitude, longitude=@longitude,
      verified_at=@verified_at WHERE user_id=@user_id`)
      .run({ ...p, address: p.address || '1 Demo Road', contact_name: p.contact_name || 'Demo Desk', contact_phone: p.contact_phone || '+91 90000 00000', verified_at: verifiedAt, user_id: userId });
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO hospitals
    (user_id,name,registration_reference,contact_name,contact_phone,address,city,locality,pin_code,latitude,longitude,verified_at)
    VALUES (@user_id,@name,@registration_reference,@contact_name,@contact_phone,@address,@city,@locality,@pin_code,@latitude,@longitude,@verified_at)`)
    .run({ user_id: userId, ...p, address: p.address || '1 Demo Road', contact_name: p.contact_name || 'Demo Desk', contact_phone: p.contact_phone || '+91 90000 00000', verified_at: verifiedAt });
  return Number(info.lastInsertRowid);
}

function upsertBank(db, userId, p, { verified }) {
  const existing = db.prepare('SELECT * FROM blood_banks WHERE user_id = ?').get(userId);
  const verifiedAt = verified ? nowIso() : null;
  const row = { user_id: userId, name: p.name, license_no: p.license_no, contact_name: 'Demo Bank Desk',
    contact_phone: '+91 90000 00010', address: '2 Demo Avenue', city: p.city, locality: p.locality,
    pin_code: p.pin_code, latitude: p.latitude, longitude: p.longitude, verified_at: verifiedAt };
  if (existing) {
    db.prepare(`UPDATE blood_banks SET name=@name, license_no=@license_no, city=@city, locality=@locality,
      pin_code=@pin_code, latitude=@latitude, longitude=@longitude, verified_at=@verified_at WHERE user_id=@user_id`).run(row);
    inventoryRepo.bootstrap(db, existing.id);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO blood_banks
    (user_id,name,license_no,contact_name,contact_phone,address,city,locality,pin_code,latitude,longitude,verified_at)
    VALUES (@user_id,@name,@license_no,@contact_name,@contact_phone,@address,@city,@locality,@pin_code,@latitude,@longitude,@verified_at)`).run(row);
  const bankId = Number(info.lastInsertRowid);
  inventoryRepo.bootstrap(db, bankId);
  return bankId;
}

function setInventory(db, bankId, byGroup) {
  for (const [group, units] of Object.entries(byGroup)) {
    db.prepare(`UPDATE inventory SET units_available = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE bank_id = ? AND blood_group = ? AND component = 'RED_CELLS'`).run(units, bankId, group);
  }
}

function upsertDonor(db, userId, { bloodGroup, availability }, index) {
  const existing = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(userId);
  const row = {
    user_id: userId, display_name: `Demo Donor ${index + 1}`, blood_group: bloodGroup,
    phone_private: `+91 90000 001${String(index).padStart(2, '0')}`, email_private: `donor${index + 1}.demo@example.test`,
    city: 'Pune', locality: 'Shivajinagar', pin_code: '411005',
    approx_latitude: 18.5308 + index * 0.004, approx_longitude: 73.8475 + index * 0.004,
    availability_status: availability, availability_updated_at: nowIso(),
  };
  if (existing) {
    db.prepare(`UPDATE donors SET display_name=@display_name, blood_group=@blood_group, phone_private=@phone_private,
      email_private=@email_private, city=@city, locality=@locality, pin_code=@pin_code,
      approx_latitude=@approx_latitude, approx_longitude=@approx_longitude,
      availability_status=@availability_status, availability_updated_at=@availability_updated_at,
      next_contact_after = NULL WHERE user_id=@user_id`).run(row);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO donors
    (user_id,display_name,blood_group,phone_private,email_private,city,locality,pin_code,approx_latitude,approx_longitude,availability_status,availability_updated_at)
    VALUES (@user_id,@display_name,@blood_group,@phone_private,@email_private,@city,@locality,@pin_code,@approx_latitude,@approx_longitude,@availability_status,@availability_updated_at)`).run(row);
  return Number(info.lastInsertRowid);
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Seed / refresh the deterministic demo environment. Idempotent, synchronous.
 * Uses bcrypt.hashSync (no libuv threadpool) so short-lived seed scripts exit
 * cleanly alongside the better-sqlite3 native module.
 * @param {import('better-sqlite3').Database} db
 * @returns {object} a summary (no secrets)
 */
function seedDemo(db) {
  assertPasswordPolicy(config.demoPassword);
  const passwordHash = bcrypt.hashSync(config.demoPassword, config.bcryptRounds);
  const summary = { admin: 0, hospital: 0, banks: 0, donors: 0, surgeHospitals: 0 };

  const run = db.transaction(() => {
    const admin = upsertUser(db, { ...ADMIN, passwordHash, isVerified: 1 });
    summary.admin = 1;
    void admin;

    const hu = upsertUser(db, { email: HOSPITAL.email, role: 'HOSPITAL', passwordHash, isVerified: 1 });
    upsertHospital(db, hu.id, HOSPITAL.profile, { verified: true });
    summary.hospital = 1;

    for (const bank of BANKS) {
      const bu = upsertUser(db, { email: bank.email, role: 'BLOOD_BANK', passwordHash, isVerified: 1 });
      const bankId = upsertBank(db, bu.id, bank.profile, { verified: true });
      setInventory(db, bankId, bank.inventory);
      summary.banks += 1;
    }

    DONORS.forEach((donor, i) => {
      const du = upsertUser(db, { email: donor.email, role: 'DONOR', passwordHash, isVerified: 0 });
      upsertDonor(db, du.id, donor, i);
      summary.donors += 1;
    });

    SURGE_HOSPITALS.forEach((h) => {
      const su = upsertUser(db, { email: h.email, role: 'HOSPITAL', passwordHash, isVerified: 1 });
      upsertHospital(db, su.id, h.profile, { verified: true });
      summary.surgeHospitals += 1;
    });
  });
  run();

  // Cold-start synthetic surge baseline so the surge demo works before enough
  // real request history exists (same data the server ensures at startup).
  baselineService.ensureSyntheticBaseline(db);

  return summary;
}

/**
 * Inject the fresh surge DEMO spike (created_at = now) so the detector raises a
 * PENDING candidate in the next pass. Run this right before the surge demo.
 * @param {import('better-sqlite3').Database} db
 * @returns {number} number of synthetic requests inserted
 */
function injectSurgeScenario(db) {
  const hospitalIds = SURGE_HOSPITALS.map((h) => {
    const row = db.prepare(`SELECT hsp.id FROM hospitals hsp JOIN users u ON u.id = hsp.user_id WHERE u.email = ?`).get(h.email);
    if (!row) throw new Error(`surge demo hospital missing: ${h.email} — run demo:seed first`);
    return row.id;
  });
  const now = Date.now();
  const stmt = db.prepare(`INSERT INTO requests
    (client_request_id, hospital_id, blood_group, component, units_needed, backup_slots, urgency, status,
     is_synthetic, scenario_id, created_at, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 2, 0, 'CRITICAL', 'OPEN', 1, 'DEMO_SURGE_AHMEDABAD_O_NEG', ?, ?)`);
  const insertMany = db.transaction(() => {
    for (let i = 0; i < SURGE_REQUEST_COUNT; i += 1) {
      const createdAt = new Date(now - 1000 - i * 3 * 60 * 1000).toISOString(); // spread over ~24 min
      stmt.run(`demo-surge-${now}-${i}`, hospitalIds[i % hospitalIds.length], createdAt, new Date(now + 3600000).toISOString());
    }
  });
  insertMany();
  return SURGE_REQUEST_COUNT;
}

const { DEMO_ACCOUNTS } = require('./demo-accounts');

module.exports = {
  seedDemo,
  injectSurgeScenario,
  DEMO_ACCOUNTS,
  ADMIN,
  HOSPITAL,
  BANKS,
  DONORS,
  SURGE_HOSPITALS,
  SURGE_CITY,
  SURGE_REQUEST_COUNT,
};
