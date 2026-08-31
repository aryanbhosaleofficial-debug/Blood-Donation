'use strict';

/**
 * E2E D — temporary location sharing → coarse ETA bands → stop → deleted.
 *
 * Proves Module 06 privacy: the hospital only ever sees an ETA band + a
 * distance band, never coordinates or an exact distance/ETA, and the exact
 * location row is physically deleted the moment the donor stops sharing.
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createDonor, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });
async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('E2E D: donor shares location → hospital sees ETA band → stop → row deleted, band UNAVAILABLE', async () => {
  const db = getDb();
  const city = 'E2EDCity';
  const hospital = await createHospital({ email: 'e2e-d-hospital@example.test', city, locality: 'Central' });
  db.prepare('UPDATE hospitals SET pin_code=?, latitude=?, longitude=? WHERE id=?').run('411001', 18.5204, 73.8567, hospital.hospital.id);
  const h = await loggedIn(hospital.user);

  const created = await h.client.post('/api/requests', requestPayload({ unitsNeeded: 2, bloodGroup: 'O-' }), write(h.token));
  const requestId = created.json.data.request.id;

  const donor = await createDonor({ email: 'e2e-d-donor@example.test', city, locality: 'Central', pinCode: '411001', bloodGroup: 'O-' });
  await h.client.post(`/api/requests/${requestId}/donor-fallback`, {}, write(h.token));
  const alert = db.prepare('SELECT id FROM donor_alerts WHERE request_id=? AND donor_id=?').get(requestId, donor.donor.id);

  const d = await loggedIn(donor.user);
  const pledgeRes = await d.client.post(`/api/donor/alerts/${alert.id}/pledge`, {}, write(d.token));
  const pledgeId = db.prepare('SELECT id FROM donor_pledges WHERE request_id=? AND donor_id=?').get(requestId, donor.donor.id).id;
  const publicRef = pledgeRes.json.data.pledge.publicReference;

  // Donor opts in to sharing an exact position ~6 km away.
  const share = await d.client.post(`/api/donor/pledges/${pledgeId}/location`, { latitude: 18.4700, longitude: 73.8300 }, write(d.token));
  assert.equal(share.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(pledgeId).n, 1);

  // Hospital sees a BAND only — no coordinates, no exact number.
  const summary = await h.client.get(`/api/requests/${requestId}/pledges`, write(h.token));
  const pledgeView = summary.json.data.pledges.find((p) => p.publicReference === publicRef);
  assert.equal(pledgeView.etaStatus, 'AVAILABLE');
  assert.ok(typeof pledgeView.etaBand === 'string' && /\d/.test(pledgeView.etaBand));
  assert.ok(typeof pledgeView.distanceBand === 'string');
  const blob = JSON.stringify(summary.json).toLowerCase();
  for (const leak of ['latitude', 'longitude', '18.47', '73.83', 'live_lat', 'straightlinekm', 'etaminutes']) {
    assert.ok(!blob.includes(leak), `hospital view must not leak ${leak}`);
  }

  // Donor stops sharing → row physically deleted, band goes UNAVAILABLE.
  const stop = await d.client.del(`/api/donor/pledges/${pledgeId}/location`, write(d.token));
  assert.equal(stop.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(pledgeId).n, 0);

  const summary2 = await h.client.get(`/api/requests/${requestId}/pledges`, write(h.token));
  const pledgeView2 = summary2.json.data.pledges.find((p) => p.publicReference === publicRef);
  assert.equal(pledgeView2.etaStatus, 'UNAVAILABLE');
  assert.equal(pledgeView2.etaBand, null);
});
