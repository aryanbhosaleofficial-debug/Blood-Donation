'use strict';

/**
 * tests/integration/surge-detection.test.js
 *
 * Module 09 — detector behaviour. Test Groups:
 *   A normal demand -> no candidate
 *   B low count     -> no candidate (even with a low p-value)
 *   C statistical surge -> candidate created
 *   D distinct-hospital evidence is correct
 *   E one-hospital spike -> distinctHospitals = 1 (weaker distribution evidence)
 *   F geographic concentration
 *   G geographic spread
 *   H missing coordinates -> UNAVAILABLE, no crash
 *   I inventory depletion evidence
 *   K synthetic/real separation
 *   L DEMO-mode candidate is is_synthetic = true with SYNTHETIC baseline source
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.SURGE_MIN_REQUEST_COUNT = '5';
process.env.SURGE_P_VALUE_THRESHOLD = '0.01';
process.env.SURGE_ANALYSIS_WINDOW_MINUTES = '60';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-detect-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createBank } = require('../helpers/orgs');
const { createCityHospitals, insertRequests, seedInventory } = require('../helpers/surge');
const baselineService = require('../../src/modules/surge/baseline.service');
const detector = require('../../src/modules/surge/surge-detector.service');
const repo = require('../../src/modules/surge/surge.repository');

getDb();
test.before(() => baselineService.ensureSyntheticBaseline(getDb()));
test.after(() => closeDatabase());

const NOW = Date.now();

function latestCandidate(db, city, bloodGroup = 'O-') {
  return db.prepare(
    "SELECT * FROM surge_candidates WHERE city = ? AND blood_group = ? ORDER BY id DESC LIMIT 1"
  ).get(city, bloodGroup);
}

test('A: normal demand (observed ~ expected) produces no candidate', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(2, { city: 'NormalCity' });
  baselineService.ensureSyntheticBaseline(db);
  // synthetic baseline only covers Ahmedabad; give NormalCity a modest baseline
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'NormalCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 6, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 5, endMs: NOW, bloodGroup: 'O-' });
  const res = detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  assert.equal(res.created, 0);
  assert.equal(latestCandidate(db, 'NormalCity'), undefined);
});

test('B: a spike below SURGE_MIN_REQUEST_COUNT produces no candidate', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(2, { city: 'LowCountCity' });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'LowCountCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.1, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 4, endMs: NOW }); // 4 < 5, p-value would be tiny
  const res = detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  assert.equal(latestCandidate(db, 'LowCountCity'), undefined);
  assert.equal(res.created, 0);
});

test('C/D/F/L: 8 synthetic O- requests from 3 concentrated Ahmedabad hospitals -> PENDING synthetic candidate', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad', concentrated: true });
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: NOW, bloodGroup: 'O-' });

  const res = detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  assert.equal(res.created, 1);

  const c = latestCandidate(db, 'Ahmedabad');
  assert.ok(c);
  assert.equal(c.status, 'PENDING');
  assert.equal(c.observed_request_count, 8);
  assert.ok(c.poisson_tail_probability < 0.01);
  assert.equal(c.distinct_hospital_count, 3);           // D
  assert.equal(c.geographic_signal, 'CONCENTRATED');    // F
  assert.equal(c.is_synthetic, 1);                      // L
  assert.equal(c.baseline_source, 'SYNTHETIC');         // L
  assert.ok(c.signal_score > 0 && c.signal_score <= 100);
});

test('E: a spike from ONE hospital reports distinctHospitals = 1', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(1, { city: 'SingleHospCity' });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'SingleHospCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 7, endMs: NOW });
  detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  const c = latestCandidate(db, 'SingleHospCity');
  assert.ok(c);
  assert.equal(c.distinct_hospital_count, 1);
});

test('G: widely separated hospitals do not report CONCENTRATED', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(3, { city: 'SpreadCity', concentrated: false });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'SpreadCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 9, endMs: NOW });
  detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  const c = latestCandidate(db, 'SpreadCity');
  assert.ok(c);
  assert.notEqual(c.geographic_signal, 'CONCENTRATED');
});

test('H: missing hospital coordinates -> geographic_signal UNAVAILABLE, no crash', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(2, { city: 'NoCoordsCity' });
  db.prepare('UPDATE hospitals SET latitude = NULL, longitude = NULL WHERE id IN (?, ?)').run(hospitals[0], hospitals[1]);
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'NoCoordsCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: NOW });
  assert.doesNotThrow(() => detector.runDetection({ mode: 'DEMO', nowMs: NOW, db }));
  const c = latestCandidate(db, 'NoCoordsCity');
  assert.ok(c);
  assert.equal(c.geographic_signal, 'UNAVAILABLE');
  assert.equal(c.geographic_radius_km, null);
});

test('I: recorded matching-inventory depletion appears in candidate evidence', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(2, { city: 'DepletionCity' });
  const { bank } = await createBank();
  db.prepare("UPDATE blood_banks SET city = 'DepletionCity' WHERE id = ?").run(bank.id);
  seedInventory(bank.id, { units: 2, depletionInWindowEndMs: NOW });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'DepletionCity', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: NOW });
  detector.runDetection({ mode: 'DEMO', nowMs: NOW, db });
  const c = latestCandidate(db, 'DepletionCity');
  assert.ok(c);
  assert.equal(c.inventory_depletion_units, 9);
  assert.equal(c.recorded_inventory_units, 2);
  assert.equal(c.fresh_inventory_rows, 1);
});

test('K: REAL mode ignores synthetic requests (and there is no real baseline)', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(3, { city: 'RealModeCity' });
  insertRequests({ hospitalIds: hospitals, count: 10, endMs: NOW, synthetic: true });
  const res = detector.runDetection({ mode: 'REAL', nowMs: NOW, db });
  assert.equal(res.skippedReason, 'insufficient_real_baseline');
  assert.equal(res.created, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM surge_candidates WHERE city = 'RealModeCity'").get().n,
    0,
  );
});
