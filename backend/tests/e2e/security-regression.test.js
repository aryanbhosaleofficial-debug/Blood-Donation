'use strict';

/**
 * E2E — consolidated security & privacy regression across all modules.
 *
 * Fast checks that the cross-cutting guarantees still hold after every module:
 *   - unauthenticated + wrong-role access is blocked
 *   - CSRF token + Origin are required on mutations
 *   - cross-account (IDOR) reads/writes are blocked
 *   - admin-only surfaces (audit, metrics, surge) are not public
 *   - GET is side-effect free
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, createDonor, requestPayload } = require('../helpers/orgs');
const { createTestUser } = require('../helpers/users');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (t, origin = ORIGIN) => ({ headers: { Origin: origin, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });
async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('unauthenticated access to protected + admin surfaces is blocked', async () => {
  const anon = srv.client();
  assert.equal((await anon.get('/api/requests')).status, 401);
  assert.equal((await anon.get('/api/notifications')).status, 401);
  assert.equal((await anon.get('/api/admin/audit-logs')).status, 401);
  assert.equal((await anon.get('/api/admin/metrics')).status, 401);
  assert.equal((await anon.get('/api/admin/surge/candidates')).status, 401);
  // no public surge / donor-directory endpoints exist
  assert.equal((await anon.get('/api/surge')).status, 404);
  assert.equal((await anon.get('/api/donors')).status, 404);
});

test('wrong-role access to admin surfaces is 403', async () => {
  const hospital = await createHospital({ email: 'sec-h@example.test' });
  const h = await loggedIn(hospital.user);
  for (const path of ['/api/admin/audit-logs', '/api/admin/metrics', '/api/admin/surge/candidates']) {
    assert.equal((await h.client.get(path, write(h.token))).status, 403, path);
  }
});

test('mutations require a CSRF token and a valid Origin', async () => {
  const hospital = await createHospital({ email: 'sec-csrf-h@example.test' });
  const h = await loggedIn(hospital.user);

  const noToken = await h.client.post('/api/requests', requestPayload(), { headers: { Origin: ORIGIN } });
  assert.equal(noToken.status, 403);

  const badOrigin = await h.client.post('/api/requests', requestPayload(), { headers: { Origin: 'https://evil.example.com', 'X-CSRF-Token': h.token } });
  assert.equal(badOrigin.status, 403);

  const ok = await h.client.post('/api/requests', requestPayload(), write(h.token));
  assert.equal(ok.status, 201);
});

test('IDOR: hospital A cannot read hospital B\'s request; bank cannot allocate without a broadcast', async () => {
  const db = getDb();
  const hospitalA = await createHospital({ email: 'sec-idor-a@example.test' });
  const hospitalB = await createHospital({ email: 'sec-idor-b@example.test' });
  const a = await loggedIn(hospitalA.user);
  const b = await loggedIn(hospitalB.user);
  const created = await a.client.post('/api/requests', requestPayload(), write(a.token));
  const requestId = created.json.data.request.id;

  // Hospital B: not found (anti-enumeration).
  assert.equal((await b.client.get(`/api/requests/${requestId}`, write(b.token))).status, 404);

  // A bank with NO broadcast for this request cannot allocate.
  const bank = await createBank({ email: 'sec-idor-bank@example.test' });
  db.prepare("DELETE FROM request_broadcasts WHERE request_id=? AND bank_id=?").run(requestId, bank.bank.id);
  const bk = await loggedIn(bank.user);
  const alloc = await bk.client.post(`/api/requests/${requestId}/allocate`, {}, write(bk.token));
  assert.equal(alloc.status, 404);
});

test('IDOR: donor A cannot act on donor B\'s pledge; user A cannot read user B\'s notification', async () => {
  const db = getDb();
  const hospital = await createHospital({ email: 'sec-idor2-h@example.test', city: 'SecCity', locality: 'L' });
  db.prepare('UPDATE hospitals SET pin_code=?, latitude=?, longitude=? WHERE id=?').run('411001', 18.5, 73.8, hospital.hospital.id);
  const h = await loggedIn(hospital.user);
  const created = await h.client.post('/api/requests', requestPayload({ bloodGroup: 'O-' }), write(h.token));
  const requestId = created.json.data.request.id;

  const donorA = await createDonor({ email: 'sec-idor2-a@example.test', city: 'SecCity', locality: 'L', pinCode: '411001', bloodGroup: 'O-' });
  const donorB = await createDonor({ email: 'sec-idor2-b@example.test', city: 'SecCity', locality: 'L', pinCode: '411001', bloodGroup: 'O-' });
  await h.client.post(`/api/requests/${requestId}/donor-fallback`, {}, write(h.token));
  const alertA = db.prepare('SELECT id FROM donor_alerts WHERE request_id=? AND donor_id=?').get(requestId, donorA.donor.id);

  const da = await loggedIn(donorA.user);
  await da.client.post(`/api/donor/alerts/${alertA.id}/pledge`, {}, write(da.token));
  const pledgeId = db.prepare('SELECT id FROM donor_pledges WHERE request_id=? AND donor_id=?').get(requestId, donorA.donor.id).id;

  // Donor B cannot cancel donor A's pledge.
  const db2 = await loggedIn(donorB.user);
  const steal = await db2.client.post(`/api/donor/pledges/${pledgeId}/cancel`, {}, write(db2.token));
  assert.ok(steal.status === 404 || steal.status === 403, `expected 403/404, got ${steal.status}`);

  // Notification IDOR: a fresh user cannot read someone else's notification id.
  const notif = db.prepare("SELECT id FROM notifications ORDER BY id DESC LIMIT 1").get();
  if (notif) {
    const stranger = await createTestUser({ role: 'DONOR', isActive: 1, isVerified: 1 });
    const s = await loggedIn(stranger);
    const res = await s.client.get(`/api/notifications/${notif.id}`, write(s.token));
    assert.ok(res.status === 404 || res.status === 403, `notification IDOR -> ${res.status}`);
  }
});

test('GET requests do not mutate request state', async () => {
  const db = getDb();
  const hospital = await createHospital({ email: 'sec-get-h@example.test' });
  const h = await loggedIn(hospital.user);
  const created = await h.client.post('/api/requests', requestPayload(), write(h.token));
  const requestId = created.json.data.request.id;
  db.prepare("UPDATE requests SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') WHERE id=?").run(requestId);

  for (let i = 0; i < 3; i += 1) await h.client.get(`/api/requests/${requestId}`, write(h.token));
  // GET must not have run expiry — status is still OPEN (only the cleanup job does that).
  assert.equal(db.prepare('SELECT status FROM requests WHERE id=?').get(requestId).status, 'OPEN');
});
