'use strict';

/**
 * tests/integration/surge-audit.test.js
 *
 * Module 09 — Test Group Y + audit privacy.
 *   detection  -> SURGE_CANDIDATE_DETECTED  (system actor, NULL)
 *   confirm    -> SURGE_CANDIDATE_CONFIRMED (admin actor)
 *   reject     -> SURGE_CANDIDATE_REJECTED  (admin actor)
 *   metadata contains only aggregate demand evidence — no donor contact,
 *   coordinates, patient data, or request notes.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-audit-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createTestUser } = require('../helpers/users');
const { createCityHospitals, insertRequests } = require('../helpers/surge');
const baselineService = require('../../src/modules/surge/baseline.service');
const detector = require('../../src/modules/surge/surge-detector.service');
const surgeService = require('../../src/modules/surge/surge.service');

getDb();
test.before(() => baselineService.ensureSyntheticBaseline(getDb()));
test.after(() => closeDatabase());

function surgeAudit(db, action) {
  return db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1').get(action);
}

async function detectOne(city) {
  const db = getDb();
  if (city !== 'Ahmedabad') {
    for (let h = 0; h < 24; h += 1) {
      require('../../src/modules/surge/baseline.repository').upsert(db, {
        city, bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
      });
    }
  }
  const hospitals = await createCityHospitals(3, { city });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  return db.prepare('SELECT * FROM surge_candidates WHERE city = ? ORDER BY id DESC LIMIT 1').get(city);
}

test('Y: detection writes SURGE_CANDIDATE_DETECTED with a NULL (system) actor and safe metadata', async () => {
  const db = getDb();
  const cand = await detectOne('Ahmedabad');
  const row = surgeAudit(db, 'SURGE_CANDIDATE_DETECTED');
  assert.ok(row);
  assert.equal(row.actor_user_id, null);
  assert.equal(row.entity_id, cand.id);
  const meta = JSON.parse(row.metadata_json);
  assert.equal(meta.city, 'Ahmedabad');
  assert.equal(meta.observed, 8);
  assert.ok(typeof meta.poissonTailProbability === 'number');
});

test('Y: confirm writes SURGE_CANDIDATE_CONFIRMED with the admin actor', async () => {
  const db = getDb();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const cand = await detectOne('Rajkot');
  surgeService.confirmCandidate(admin.id, cand.id, 'confirmed for monitoring');
  const row = surgeAudit(db, 'SURGE_CANDIDATE_CONFIRMED');
  assert.equal(row.actor_user_id, admin.id);
  assert.equal(row.entity_id, cand.id);
  assert.equal(JSON.parse(row.metadata_json).statusTo, 'CONFIRMED');
});

test('Y: reject writes SURGE_CANDIDATE_REJECTED with the admin actor', async () => {
  const db = getDb();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const cand = await detectOne('Surat');
  surgeService.rejectCandidate(admin.id, cand.id, 'known test exercise');
  const row = surgeAudit(db, 'SURGE_CANDIDATE_REJECTED');
  assert.equal(row.actor_user_id, admin.id);
  assert.equal(JSON.parse(row.metadata_json).statusTo, 'REJECTED');
});

test('audit privacy: no surge audit metadata contains donor contact / coordinates / patient data', async () => {
  const db = getDb();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const cand = await detectOne('Vadodara');
  surgeService.confirmCandidate(admin.id, cand.id, 'note');
  const rows = db.prepare("SELECT metadata_json FROM audit_logs WHERE action LIKE 'SURGE_%'").all();
  assert.ok(rows.length >= 2);
  for (const r of rows) {
    const lower = r.metadata_json.toLowerCase();
    for (const bad of ['phone', 'email', 'latitude', 'longitude', 'lat"', 'lng', 'password', 'csrf', 'session', 'patient', 'request_note']) {
      assert.ok(!lower.includes(bad), `surge audit metadata must not contain "${bad}"`);
    }
  }
});
