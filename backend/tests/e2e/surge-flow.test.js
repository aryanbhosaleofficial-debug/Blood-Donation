'use strict';

/**
 * E2E G — synthetic demand spike → detector → PENDING candidate → ADMIN
 * confirms over HTTP → ACTIVE surge event, with audit + notification + metrics.
 *
 * Also proves the "normal demand" control: an ordinary volume never raises a
 * candidate. Uses the injected demo scenario data (deterministic).
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { createHospital } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');
const baselineService = require('../../src/modules/surge/baseline.service');
const detector = require('../../src/modules/surge/surge-detector.service');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); baselineService.ensureSyntheticBaseline(getDb()); });
after(async () => { await srv.close(); closeDatabase(); });

async function adminClient() {
  const client = srv.client();
  const user = await createTestUser({ role: 'ADMIN', isActive: 1, isVerified: 1 });
  const token = await loginAs(client, user);
  return { client, token, user };
}

function seedRequests(db, city, { count, synthetic, bloodGroup = 'O-', endMs = Date.now() }) {
  const hospitals = db.prepare('SELECT hsp.id FROM hospitals hsp JOIN users u ON u.id = hsp.user_id WHERE hsp.city = ?').all(city).map((r) => r.id);
  const stmt = db.prepare(`INSERT INTO requests
    (client_request_id, hospital_id, blood_group, component, units_needed, backup_slots, urgency, status, is_synthetic, scenario_id, created_at, expires_at)
    VALUES (?, ?, ?, 'RED_CELLS', 2, 0, 'CRITICAL', 'OPEN', ?, ?, ?, ?)`);
  for (let i = 0; i < count; i += 1) {
    stmt.run(`e2e-surge-${city}-${endMs}-${i}`, hospitals[i % hospitals.length], bloodGroup,
      synthetic ? 1 : 0, synthetic ? 'E2E_SURGE' : null,
      new Date(endMs - 1000 - i * 90 * 1000).toISOString(), new Date(endMs + 3600000).toISOString());
  }
}

test('E2E G control: ordinary synthetic demand does not raise a candidate', async () => {
  const db = getDb();
  const city = 'E2ENormalCity';
  for (let i = 0; i < 3; i += 1) await createHospital({ email: `e2e-normal-h${i}@example.test`, city });
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city, bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 6, sampleDays: 30, isSynthetic: 1,
    });
  }
  seedRequests(db, city, { count: 4, synthetic: true });
  const res = detector.runDetection({ mode: 'DEMO', nowMs: Date.now(), db });
  assert.equal(res.created, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM surge_candidates WHERE city=?").get(city).n, 0);
});

test('E2E G: synthetic spike → PENDING candidate → admin confirm → ACTIVE event (+audit +notification +metrics)', async () => {
  const db = getDb();
  const city = 'E2ESurgeCity';
  // Create the ADMIN before detection so the SURGE_CANDIDATE_DETECTED
  // notification has a recipient.
  const admin = await adminClient();
  for (let i = 0; i < 3; i += 1) {
    const hh = await createHospital({ email: `e2e-surge-h${i}@example.test`, city });
    db.prepare('UPDATE hospitals SET latitude=?, longitude=? WHERE id=?').run(23.02 + i * 0.02, 72.57 + i * 0.02, hh.hospital.id);
  }
  for (let h = 0; h < 24; h += 1) {
    require('../../src/modules/surge/baseline.repository').upsert(db, {
      city, bloodGroup: 'O-', component: 'RED_CELLS', localHour: h, lambda: 0.5, sampleDays: 30, isSynthetic: 1,
    });
  }
  seedRequests(db, city, { count: 8, synthetic: true });

  const res = detector.runDetection({ mode: 'DEMO', nowMs: Date.now(), db });
  assert.equal(res.created, 1);
  const candidate = db.prepare("SELECT * FROM surge_candidates WHERE city=? ORDER BY id DESC LIMIT 1").get(city);
  assert.equal(candidate.status, 'PENDING');
  assert.equal(candidate.is_synthetic, 1);
  assert.ok(candidate.poisson_tail_probability < 0.01);

  // ADMIN lists + reads the candidate.
  const listed = await admin.client.get('/api/admin/surge/candidates?status=PENDING', write(admin.token));
  assert.equal(listed.status, 200);
  assert.ok(listed.json.data.candidates.some((c) => c.id === candidate.id));

  // ADMIN confirms → CONFIRMED + one ACTIVE event.
  const confirm = await admin.client.post(`/api/admin/surge/candidates/${candidate.id}/confirm`, { note: 'operational monitoring' }, write(admin.token));
  assert.equal(confirm.status, 200);
  assert.equal(confirm.json.data.candidate.status, 'CONFIRMED');
  assert.equal(confirm.json.data.event.status, 'ACTIVE');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM surge_events WHERE candidate_id=?').get(candidate.id).n, 1);

  // Audit: detection (system, NULL) + confirmation (admin).
  assert.equal(db.prepare("SELECT actor_user_id a FROM audit_logs WHERE action='SURGE_CANDIDATE_DETECTED' AND entity_id=?").get(candidate.id).a, null);
  assert.equal(db.prepare("SELECT actor_user_id a FROM audit_logs WHERE action='SURGE_CANDIDATE_CONFIRMED' AND entity_id=?").get(candidate.id).a, admin.user.id);

  // Notification for the admin; safe wording.
  const notif = db.prepare("SELECT message FROM notifications WHERE recipient_user_id=? AND event_type='SURGE_CANDIDATE_DETECTED'").get(admin.user.id);
  assert.ok(notif);
  assert.ok(!/disaster detected|mass casualty|crisis predicted/i.test(notif.message));

  // Metrics reflect it.
  const metrics = await admin.client.get('/api/admin/metrics', write(admin.token));
  assert.ok(metrics.json.data.metrics.surge.confirmedCandidates >= 1);
  assert.ok(metrics.json.data.metrics.surge.activeSurgeEvents >= 1);
});
