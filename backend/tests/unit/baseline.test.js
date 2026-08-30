'use strict';

/**
 * tests/unit/baseline.test.js
 *
 * Module 09 — demand baseline: synthetic cold-start data, real generation,
 * real/synthetic separation, minimum-history behaviour, and timezone-aware
 * local-hour bucketing.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.SURGE_MIN_BASELINE_DAYS = '7';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-baseline-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createHospital, rand } = require('../helpers/orgs');
const baselineService = require('../../src/modules/surge/baseline.service');
const baselineRepo = require('../../src/modules/surge/baseline.repository');
const { localHour } = require('../../src/modules/surge/surge.window');

getDb();
test.after(() => closeDatabase());

function seedRealRequest(db, hospitalId, { bloodGroup = 'O-', createdAt }) {
  db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, is_synthetic, created_at, expires_at)
    VALUES (?, ?, ?, 'RED_CELLS', 1, 0, 'NORMAL', 'OPEN', 0, ?, ?)
  `).run(`cr-${rand()}`, hospitalId, bloodGroup, createdAt, new Date(Date.parse(createdAt) + 3600000).toISOString());
}

test('localHour converts a UTC instant to the configured timezone hour', () => {
  // 2026-01-01T18:30:00Z == 2026-01-02 00:00 IST -> hour 0
  assert.equal(localHour('2026-01-01T18:30:00.000Z', 'Asia/Kolkata'), 0);
  // 2026-01-01T20:00:00Z == 01:30 IST -> hour 1
  assert.equal(localHour('2026-01-01T20:00:00.000Z', 'Asia/Kolkata'), 1);
  // hour boundary: 18:29:59Z -> 23:59 IST -> hour 23
  assert.equal(localHour('2026-01-01T18:29:59.000Z', 'Asia/Kolkata'), 23);
});

test('ensureSyntheticBaseline creates deterministic is_synthetic=1 rows incl. the demo scenario', () => {
  const db = getDb();
  baselineService.ensureSyntheticBaseline(db);
  assert.equal(baselineRepo.countBySynthetic(db, 1), 8 * 24); // 8 groups x 24 hours for Ahmedabad
  assert.equal(baselineRepo.countBySynthetic(db, 0), 0);

  const scenario = baselineRepo.find(db, { city: 'Ahmedabad', bloodGroup: 'O-', component: 'RED_CELLS', localHour: 10, isSynthetic: 1 });
  const ordinary = baselineRepo.find(db, { city: 'Ahmedabad', bloodGroup: 'A+', component: 'RED_CELLS', localHour: 10, isSynthetic: 1 });
  assert.ok(scenario.lambda > ordinary.lambda, 'demo O- scenario lambda is higher');

  // idempotent
  baselineService.ensureSyntheticBaseline(db);
  assert.equal(baselineRepo.countBySynthetic(db, 1), 8 * 24);
});

test('generateRealBaseline aggregates only non-synthetic requests and stays separate from synthetic rows', async () => {
  const db = getDb();
  db.prepare('DELETE FROM demand_baselines WHERE is_synthetic = 0').run();
  const { hospital } = await createHospital({ city: 'Pune' });
  const now = Date.now();

  // 10 real O- requests spread across the last ~5 days (all within the 7-day window).
  for (let i = 0; i < 10; i += 1) {
    seedRealRequest(db, hospital.id, { createdAt: new Date(now - i * 12 * 60 * 60 * 1000).toISOString() });
  }
  // a synthetic request that must NOT pollute the real baseline
  db.prepare(`
    INSERT INTO requests (client_request_id, hospital_id, blood_group, component, units_needed,
                          backup_slots, urgency, status, is_synthetic, created_at, expires_at)
    VALUES (?, ?, 'O-', 'RED_CELLS', 1, 0, 'NORMAL', 'OPEN', 1, ?, ?)
  `).run(`cr-${rand()}`, hospital.id, new Date(now).toISOString(), new Date(now + 3600000).toISOString());

  const result = baselineService.generateRealBaseline({ db, nowMs: now });
  assert.ok(result.groups >= 1);
  assert.equal(baselineRepo.countBySynthetic(db, 0) > 0, true);

  const totalRealCount = db.prepare(
    'SELECT COALESCE(SUM(request_count),0) AS c FROM demand_baselines WHERE is_synthetic = 0'
  ).get().c;
  assert.equal(totalRealCount, 10); // synthetic request excluded
});

test('hasSufficientRealBaseline is false until enough days of real history exist', () => {
  const db = getDb();
  db.prepare('DELETE FROM requests').run();
  db.prepare('DELETE FROM demand_baselines WHERE is_synthetic = 0').run();
  const now = Date.now();
  assert.equal(baselineService.hasSufficientRealBaseline(db, now), false);
});
