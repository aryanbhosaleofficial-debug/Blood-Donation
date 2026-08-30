'use strict';

/**
 * tests/integration/surge-notifications.test.js
 *
 * Module 09 — Test Groups W / X.
 *   W — a new candidate queues a SURGE_CANDIDATE_DETECTED notification for
 *       ADMIN users (transactional outbox; provider still runs afterwards).
 *   X — a repeated duplicate detection does not queue a duplicate logical
 *       admin notification.
 *   + confirmation queues SURGE_CONFIRMED for admins; never a public broadcast.
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'Asia/Kolkata';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbdms-surge-notif-'));
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
baselineService.ensureSyntheticBaseline(getDb());
test.after(() => closeDatabase());

test('W: a new candidate queues SURGE_CANDIDATE_DETECTED for every active ADMIN (QUEUED, provider runs later)', async () => {
  const db = getDb();
  const admin1 = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const admin2 = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const hospitalUser = await createTestUser({ role: 'HOSPITAL', isActive: 1, isVerified: 1 });

  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });

  for (const a of [admin1, admin2]) {
    const n = db.prepare("SELECT * FROM notifications WHERE recipient_user_id = ? AND event_type = 'SURGE_CANDIDATE_DETECTED'").get(a.id);
    assert.ok(n, 'admin notified');
    assert.equal(n.status, 'QUEUED');
    // Safe wording: it may say "not a disaster prediction", but must never
    // assert a disaster / mass-casualty / emergency event.
    assert.ok(!/disaster detected|disaster confirmed|mass[- ]casualty|emergency (event )?confirmed|crisis predicted/i.test(n.message),
      `unsafe wording: ${n.message}`);
    assert.ok(/review/i.test(n.message), 'asks for admin review');
  }
  // never sent to a non-admin
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND event_type = 'SURGE_CANDIDATE_DETECTED'").get(hospitalUser.id).n,
    0,
  );

  // The rows are QUEUED inside the detection transaction; the Module 07 worker
  // delivers them afterwards (never inside the transaction). Deliver once here
  // via the worker service.
  // eslint-disable-next-line global-require
  const stats = require('../../src/modules/notifications/notification-worker.service').processBatch();
  assert.ok(stats.sent >= 2);
});

test('X: a repeated detection does not duplicate the admin notification', async () => {
  const db = getDb();
  db.prepare("DELETE FROM notifications").run();
  db.prepare("DELETE FROM surge_candidates").run();
  db.prepare("DELETE FROM requests").run();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });

  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 9, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });

  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND event_type = 'SURGE_CANDIDATE_DETECTED'").get(admin.id).n,
    1,
  );
});

test('confirmation queues SURGE_CONFIRMED for admins only', async () => {
  const db = getDb();
  db.prepare("DELETE FROM notifications").run();
  db.prepare("DELETE FROM surge_candidates").run();
  db.prepare("DELETE FROM requests").run();
  const admin = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const donor = await createTestUser({ role: 'DONOR', isActive: 1, isVerified: 1 });

  const hospitals = await createCityHospitals(3, { city: 'Ahmedabad' });
  const now = Date.now();
  insertRequests({ hospitalIds: hospitals, count: 8, endMs: now, bloodGroup: 'O-' });
  detector.runDetection({ mode: 'DEMO', nowMs: now, db });
  const cand = db.prepare("SELECT id FROM surge_candidates ORDER BY id DESC LIMIT 1").get();

  surgeService.confirmCandidate(admin.id, cand.id, 'ok');

  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE recipient_user_id = ? AND event_type = 'SURGE_CONFIRMED'").get(admin.id));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ? AND event_type = 'SURGE_CONFIRMED'").get(donor.id).n, 0);
});
