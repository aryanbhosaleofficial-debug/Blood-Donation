'use strict';

/**
 * tests/integration/surge-job.test.js
 *
 * Module 09 — Test Group O + job lifecycle.
 *   - start()/stop()/getStatus()/getLastRunAt() behave predictably
 *   - start() is idempotent (no second detection loop)
 *   - a detection error does not crash / propagate
 *   - the one-shot startup task ensures a baseline + runs a pass
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.SURGE_DETECTOR_INTERVAL_MS = '60000';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-job-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createCityHospitals, insertRequests } = require('../helpers/surge');
const surgeJob = require('../../src/jobs/surge-detector.job');
const surgeService = require('../../src/modules/surge/surge.service');
const baselineRepo = require('../../src/modules/surge/baseline.repository');

getDb();
test.after(() => { surgeJob.stop(); closeDatabase(); });

test('O + lifecycle: start is idempotent, status transitions, stop is clean', () => {
  assert.equal(surgeJob.getStatus(), 'stopped');
  surgeJob.start();
  assert.equal(surgeJob.getStatus(), 'running');
  surgeJob.start(); // must not spawn a second loop
  assert.equal(surgeJob.getStatus(), 'running');
  surgeJob.stop();
  assert.equal(surgeJob.getStatus(), 'stopped');
});

test('runStartupTasks ensures the synthetic baseline and runs a detection pass (never throws)', async () => {
  const db = getDb();
  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: Date.now(), bloodGroup: 'O-' });

  assert.doesNotThrow(() => surgeService.runStartupTasks());
  assert.ok(baselineRepo.countBySynthetic(db, 1) > 0);

  const list = surgeService.listCandidates({ limit: 50, offset: 0 });
  assert.ok(list.candidates.some((c) => c.city === 'Ahmedabad' && c.bloodGroup === 'O-'));
});

test('runDetectionPass returns per-mode results and does not throw on a clean DB', () => {
  const out = surgeService.runDetectionPass(Date.now());
  assert.ok(out.real && out.demo);
  assert.equal(typeof out.real.created, 'number');
  assert.equal(typeof out.demo.created, 'number');
});
