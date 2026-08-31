'use strict';

/**
 * E2E B + C — bank shortage → donor fallback → pledge → arrival.
 *
 * Proves Module 04 (partial coverage) + 05 (fallback + alerts) + 06 (pledge,
 * arrival) work together, and that the hospital only ever sees a
 * request-specific public reference — never donor identity or contact.
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, createDonor, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });
async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('E2E B/C: shortage → fallback → donor pledge → arrival, with no donor identity leak to the hospital', async () => {
  const db = getDb();
  const city = 'E2EBCity';
  const bank = await createBank({ email: 'e2e-bc-bank@example.test' });
  db.prepare("UPDATE inventory SET units_available=1 WHERE bank_id=? AND blood_group='O-'").run(bank.bank.id);

  const hospital = await createHospital({ email: 'e2e-bc-hospital@example.test', city, locality: 'Central' });
  db.prepare('UPDATE hospitals SET pin_code=?, latitude=?, longitude=? WHERE id=?').run('560001', 23.03, 72.56, hospital.hospital.id);
  const h = await loggedIn(hospital.user);

  const created = await h.client.post('/api/requests', requestPayload({ unitsNeeded: 3, note: 'PRIVATE PATIENT NOTE' }), write(h.token));
  const requestId = created.json.data.request.id;

  // Bank covers only 1 of 3 → request stays OPEN.
  const b = await loggedIn(bank.user);
  await b.client.post(`/api/requests/${requestId}/allocate`, {}, write(b.token));
  assert.equal((await h.client.get(`/api/requests/${requestId}`, write(h.token))).json.data.request.status, 'OPEN');

  // Two compatible (O-) donors in the same locality.
  const donor1 = await createDonor({ email: 'e2e-bc-donor1@example.test', city, locality: 'Central', pinCode: '560001', bloodGroup: 'O-' });
  const donor2 = await createDonor({ email: 'e2e-bc-donor2@example.test', city, locality: 'Central', pinCode: '560001', bloodGroup: 'O-' });

  // Hospital activates fallback.
  const fb = await h.client.post(`/api/requests/${requestId}/donor-fallback`, {}, write(h.token));
  assert.ok(fb.status === 200 || fb.status === 201, `fallback status ${fb.status}`);
  assert.ok(fb.json.data.totalActiveAlerts >= 1);

  const alerts = db.prepare('SELECT * FROM donor_alerts WHERE request_id=? ORDER BY donor_id').all(requestId);
  assert.ok(alerts.length >= 1);

  // Donor 1 sees the alert and pledges.
  const d1 = await loggedIn(donor1.user);
  const alert1 = alerts.find((a) => a.donor_id === donor1.donor.id);
  const seen = await d1.client.get(`/api/donor/alerts/${alert1.id}`, write(d1.token));
  assert.equal(seen.status, 200);
  const pledgeRes = await d1.client.post(`/api/donor/alerts/${alert1.id}/pledge`, {}, write(d1.token));
  assert.equal(pledgeRes.status, 201);
  const publicRef = pledgeRes.json.data.pledge.publicReference;
  assert.match(publicRef, /^PDG-/);

  // Hospital pledge summary: public reference only, NO donor identity.
  const summary = await h.client.get(`/api/requests/${requestId}/pledges`, write(h.token));
  assert.equal(summary.status, 200);
  assert.equal(summary.json.data.activePotentialDonorPledges, 1);
  const sBlob = JSON.stringify(summary.json).toLowerCase();
  for (const leak of ['e2e-bc-donor1', 'phone', 'email', 'display_name', 'latitude', 'longitude', donor1.donor.display_name.toLowerCase()]) {
    assert.ok(!sBlob.includes(leak), `hospital pledge summary must not leak ${leak}`);
  }
  assert.ok(sBlob.includes(publicRef.toLowerCase()));

  // Donor marks arrived → hospital sees ARRIVED (still no identity).
  const pledgeId = db.prepare('SELECT id FROM donor_pledges WHERE request_id=? AND donor_id=?').get(requestId, donor1.donor.id).id;
  const arrive = await d1.client.post(`/api/donor/pledges/${pledgeId}/arrive`, {}, write(d1.token));
  assert.equal(arrive.status, 200);
  const summary2 = await h.client.get(`/api/requests/${requestId}/pledges`, write(h.token));
  assert.ok(summary2.json.data.pledges.some((p) => p.status === 'ARRIVED' && p.publicReference === publicRef));

  void donor2;
});
