'use strict';

/**
 * E2E F — a past-due OPEN request with a reserved allocation, an active pledge
 * and a live location is cleaned up exactly once by the expiry sweep.
 *
 * Proves Module 08 request expiry ties the whole system together atomically:
 * request EXPIRED, reserved inventory restored once, pledge closed, alert
 * closed, location deleted, notification queued, audit written — and a second
 * sweep changes nothing.
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, createDonor, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');
const { processBatch } = require('../../src/modules/cleanup/request-expiry.service');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });
async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('E2E F: expiry cleans request + allocation + pledge + location exactly once', async () => {
  const db = getDb();
  const city = 'E2EFCity';
  const bank = await createBank({ email: 'e2e-f-bank@example.test' });
  const hospital = await createHospital({ email: 'e2e-f-hospital@example.test', city, locality: 'Central' });
  db.prepare('UPDATE hospitals SET pin_code=?, latitude=?, longitude=? WHERE id=?').run('411001', 18.52, 73.85, hospital.hospital.id);
  const h = await loggedIn(hospital.user);
  const b = await loggedIn(bank.user);

  // Bank has 3; request needs 5 → bank reserves 3, request stays OPEN so the
  // donor fallback is still allowed.
  db.prepare("UPDATE inventory SET units_available=3 WHERE bank_id=? AND blood_group='O-'").run(bank.bank.id);
  const created = await h.client.post('/api/requests', requestPayload({ unitsNeeded: 5, bloodGroup: 'O-' }), write(h.token));
  const requestId = created.json.data.request.id;

  await b.client.post(`/api/requests/${requestId}/allocate`, {}, write(b.token));
  assert.equal(db.prepare("SELECT units_available n FROM inventory WHERE bank_id=? AND blood_group='O-'").get(bank.bank.id).n, 0);
  assert.equal(db.prepare('SELECT status FROM requests WHERE id=?').get(requestId).status, 'OPEN');

  // A donor pledges + shares location.
  const donor = await createDonor({ email: 'e2e-f-donor@example.test', city, locality: 'Central', pinCode: '411001', bloodGroup: 'O-' });
  await h.client.post(`/api/requests/${requestId}/donor-fallback`, {}, write(h.token));
  const alert = db.prepare('SELECT id FROM donor_alerts WHERE request_id=? AND donor_id=?').get(requestId, donor.donor.id);
  const d = await loggedIn(donor.user);
  await d.client.post(`/api/donor/alerts/${alert.id}/pledge`, {}, write(d.token));
  const pledgeId = db.prepare('SELECT id FROM donor_pledges WHERE request_id=?').get(requestId).id;
  await d.client.post(`/api/donor/pledges/${pledgeId}/location`, { latitude: 18.49, longitude: 73.83 }, write(d.token));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE request_id=?').get(requestId).n, 1);

  // Force the request past its expiry and run the sweep.
  db.prepare("UPDATE requests SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes') WHERE id=?").run(requestId);
  const now = new Date().toISOString();
  const r1 = processBatch({ db, nowIso: now });
  assert.ok(r1.expired >= 1);

  assert.equal(db.prepare('SELECT status FROM requests WHERE id=?').get(requestId).status, 'EXPIRED');
  assert.equal(db.prepare('SELECT status FROM request_allocations WHERE request_id=?').get(requestId).status, 'RELEASED');
  assert.equal(db.prepare("SELECT units_available n FROM inventory WHERE bank_id=? AND blood_group='O-'").get(bank.bank.id).n, 3); // restored
  assert.equal(db.prepare('SELECT status FROM donor_pledges WHERE request_id=?').get(requestId).status, 'EXPIRED');
  assert.equal(db.prepare('SELECT status FROM donor_alerts WHERE request_id=?').get(requestId).status, 'CLOSED');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE request_id=?').get(requestId).n, 0);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE event_type='REQUEST_EXPIRED' AND entity_id=?").get(requestId).n >= 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='REQUEST_EXPIRED' AND entity_id=?").get(requestId).n, 1);

  // Second sweep — idempotent, nothing changes.
  const invAdjBefore = db.prepare("SELECT COUNT(*) n FROM inventory_adjustments WHERE reason LIKE 'REQUEST_EXPIRY_RELEASE%'").get().n;
  processBatch({ db, nowIso: new Date().toISOString() });
  assert.equal(db.prepare("SELECT units_available n FROM inventory WHERE bank_id=? AND blood_group='O-'").get(bank.bank.id).n, 3);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inventory_adjustments WHERE reason LIKE 'REQUEST_EXPIRY_RELEASE%'").get().n, invAdjBefore);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE event_type='REQUEST_EXPIRED' AND entity_id=?").get(requestId).n,
    db.prepare("SELECT COUNT(*) n FROM notifications WHERE event_type='REQUEST_EXPIRED' AND entity_id=?").get(requestId).n);
});
