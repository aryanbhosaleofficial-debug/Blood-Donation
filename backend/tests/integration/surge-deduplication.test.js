'use strict';

/**
 * tests/integration/surge-deduplication.test.js
 *
 * Module 09 — Test Groups M / N.
 *   M — the detector run twice for the same (mode, city, group, component,
 *       time bucket) creates exactly one candidate.
 *   N — a later run in the NEXT time bucket, with a continued anomaly, can
 *       create a new candidate.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.SURGE_ANALYSIS_WINDOW_MINUTES = '60';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-dedup-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createCityHospitals, insertRequests } = require('../helpers/surge');
const baselineService = require('../../src/modules/surge/baseline.service');
const detector = require('../../src/modules/surge/surge-detector.service');

getDb();
test.before(() => baselineService.ensureSyntheticBaseline(getDb()));
test.after(() => closeDatabase());

test('M: running the detector twice for the same window creates exactly one candidate', async () => {
  const db = getDb();
  const now = Date.now();
  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });

  const first = detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  const second = detector.runDetection({ mode: 'DEMO', nowMs: now, db });

  assert.equal(first.created, 1);
  assert.equal(second.created, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM surge_candidates WHERE city = 'Ahmedabad' AND blood_group = 'O-'").get().n,
    1,
  );
});

test('N: a continued anomaly in the next time bucket can raise a new candidate', async () => {
  const db = getDb();
  db.prepare("DELETE FROM surge_candidates").run();
  db.prepare("DELETE FROM requests").run();
  const hospitals = await createCityHospitals(3, { city: 'Vadodara' });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city: 'Vadodara', bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  const windowMs = 60 * 60 * 1000;
  const t1 = Math.floor(Date.now() / windowMs) * windowMs + windowMs / 2; // middle of a bucket
  const t2 = t1 + windowMs; // next bucket

  insertRequests({ hospitalIds: hospitals, count: 8, endMs: t1, bloodGroup: 'O-', spreadMinutes: 20 });
  const r1 = detector.runDetection({ mode: 'DEMO', nowMs: t1, db });
  assert.equal(r1.created, 1);

  insertRequests({ hospitalIds: hospitals, count: 8, endMs: t2, bloodGroup: 'O-', spreadMinutes: 20 });
  const r2 = detector.runDetection({ mode: 'DEMO', nowMs: t2, db });
  assert.equal(r2.created, 1);

  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM surge_candidates WHERE city = 'Vadodara'").get().n,
    2,
  );
  const keys = db.prepare("SELECT dedupe_key FROM surge_candidates WHERE city = 'Vadodara' ORDER BY id").all();
  assert.notEqual(keys[0].dedupe_key, keys[1].dedupe_key);
});
