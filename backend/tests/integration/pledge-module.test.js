'use strict';
require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, createDonor, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');
const { createPledgeTransactions } = require('../../src/modules/pledges/pledges.transaction');

let server;
let sequence = 200000;
const write = (token, origin = ORIGIN) => ({ headers: { Origin: origin, 'X-CSRF-Token': token } });
before(async () => { server = await startTestServer(); });
after(async () => { await server.close(); closeDatabase(); });

async function logged(user) { const client = server.client(); const token = await loginAs(client, user); return { client, token }; }

async function scenario(tag, { units = 2, backup = 0, donorCount = 1, bankStock = null, hospitalCoordinates = true } = {}) {
  const pin = String(sequence++);
  const city = `${tag}City`;
  const locality = `${tag}Local`;
  let bank = null;
  if (bankStock !== null) {
    bank = await createBank({ email: `${tag}-bank@m6.test` });
    getDb().prepare("UPDATE inventory SET units_available=? WHERE bank_id=? AND blood_group='O-'").run(bankStock, bank.bank.id);
  }
  const hospital = await createHospital({ email: `${tag}-hospital@m6.test`, city, locality });
  getDb().prepare('UPDATE hospitals SET pin_code=?,latitude=?,longitude=? WHERE id=?')
    .run(pin, hospitalCoordinates ? 23.03 : null, hospitalCoordinates ? 72.56 : null, hospital.hospital.id);
  const hospitalAuth = await logged(hospital.user);
  const created = await hospitalAuth.client.post('/api/requests', requestPayload({ unitsNeeded: units, note: 'PRIVATE NOTE' }), write(hospitalAuth.token));
  const requestId = created.json.data.request.id;
  getDb().prepare('UPDATE requests SET backup_slots=? WHERE id=?').run(backup, requestId);
  const donors = [];
  for (let index = 0; index < donorCount; index += 1) {
    donors.push(await createDonor({ email: `${tag}-donor-${index}@m6.test`, city, locality, pinCode: pin }));
  }
  await hospitalAuth.client.post(`/api/requests/${requestId}/donor-fallback`, {}, write(hospitalAuth.token));
  const alerts = getDb().prepare('SELECT * FROM donor_alerts WHERE request_id=? ORDER BY donor_id').all(requestId);
  return { hospital, bank, ...hospitalAuth, requestId, donors, alerts, city, locality, pin };
}

async function pledgeAs(donor, alertId) {
  const auth = await logged(donor.user);
  const response = await auth.client.post(`/api/donor/alerts/${alertId}/pledge`, {}, write(auth.token));
  return { ...auth, response, pledge: response.json?.data?.pledge };
}

test('owned actionable alert creates one private pledge and closes the alert', async () => {
  const s = await scenario('basic', { donorCount: 2 });
  const a = await logged(s.donors[0].user);
  assert.equal((await a.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, { headers: { Origin: ORIGIN } })).status, 403);
  assert.equal((await a.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, write(a.token, 'http://evil.test'))).status, 403);
  const made = await a.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, write(a.token));
  assert.equal(made.status, 201);
  assert.match(made.json.data.pledge.publicReference, /^PDG-[A-F0-9]{8}$/);
  assert.equal(made.json.data.pledge.status, 'PLEDGED');
  assert.equal(getDb().prepare('SELECT status FROM donor_alerts WHERE id=?').get(s.alerts[0].id).status, 'CLOSED');
  const duplicate = await a.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, write(a.token));
  assert.equal(duplicate.status, 409); assert.equal(duplicate.json.error.code, 'ALREADY_PLEDGED');
  const other = await logged(s.donors[1].user);
  assert.equal((await other.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, write(other.token))).status, 404);
});

test('capacity includes backup slots and a simultaneous five-donor race cannot exceed it', async () => {
  const s = await scenario('race', { units: 2, backup: 0, donorCount: 5 });
  const clients = await Promise.all(s.donors.map((donor) => logged(donor.user)));
  const results = await Promise.all(clients.map((auth, index) => auth.client.post(`/api/donor/alerts/${s.alerts[index].id}/pledge`, {}, write(auth.token))));
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.equal(results.filter((r) => r.json?.error?.code === 'SLOTS_FULL').length, 3);
  assert.equal(getDb().prepare("SELECT COUNT(*) n FROM donor_pledges WHERE request_id=? AND status IN('PLEDGED','ARRIVED')").get(s.requestId).n, 2);
  assert.equal(createPledgeTransactions().modes.pledge, 'immediate');

  const backup = await scenario('backup', { units: 2, backup: 1, donorCount: 4 });
  for (let index = 0; index < 3; index += 1) assert.equal((await pledgeAs(backup.donors[index], backup.alerts[index].id)).response.status, 201);
  const full = await pledgeAs(backup.donors[3], backup.alerts[3].id);
  assert.equal(full.response.json.error.code, 'SLOTS_FULL');
});

test('pledge insertion rolls back if alert closure fails inside the transaction', async () => {
  const s = await scenario('pledge-rollback'); const auth = await logged(s.donors[0].user);
  getDb().exec("CREATE TEMP TRIGGER fail_pledge_alert_close BEFORE UPDATE OF status ON donor_alerts WHEN NEW.status='CLOSED' BEGIN SELECT RAISE(ABORT,'forced pledge close failure'); END");
  let response;
  try { response = await auth.client.post(`/api/donor/alerts/${s.alerts[0].id}/pledge`, {}, write(auth.token)); }
  finally { getDb().exec('DROP TRIGGER fail_pledge_alert_close'); }
  assert.equal(response.status, 500);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_pledges WHERE request_id=?').get(s.requestId).n, 0);
  assert.equal(getDb().prepare('SELECT status FROM donor_alerts WHERE id=?').get(s.alerts[0].id).status, 'ACTIVE');
});

test('cancellation deletes exact location, releases a slot, and cannot run twice', async () => {
  const s = await scenario('cancel-slot', { units: 1, donorCount: 2 });
  const first = await pledgeAs(s.donors[0], s.alerts[0].id);
  const second = await logged(s.donors[1].user);
  assert.equal((await second.client.post(`/api/donor/alerts/${s.alerts[1].id}/pledge`, {}, write(second.token))).json.error.code, 'SLOTS_FULL');
  assert.equal((await first.client.post(`/api/donor/pledges/${first.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(first.token))).status, 200);
  assert.equal((await first.client.post(`/api/donor/pledges/${first.pledge.id}/cancel`, {}, { headers: { Origin: ORIGIN } })).status, 403);
  const cancelled = await first.client.post(`/api/donor/pledges/${first.pledge.id}/cancel`, {}, write(first.token));
  assert.equal(cancelled.json.data.pledge.status, 'CANCELLED');
  assert.ok(cancelled.json.data.pledge.cancelledAt);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(first.pledge.id).n, 0);
  assert.equal((await first.client.post(`/api/donor/pledges/${first.pledge.id}/cancel`, {}, write(first.token))).json.error.code, 'INVALID_PLEDGE_STATE');
  assert.equal((await second.client.post(`/api/donor/alerts/${s.alerts[1].id}/pledge`, {}, write(second.token))).status, 201);
});

test('arrival is coordination-only and invalid transitions are rejected', async () => {
  const s = await scenario('arrival'); const p = await pledgeAs(s.donors[0], s.alerts[0].id);
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/arrive`, {}, { headers: { Origin: ORIGIN } })).status, 403);
  const arrived = await p.client.post(`/api/donor/pledges/${p.pledge.id}/arrive`, {}, write(p.token));
  assert.equal(arrived.json.data.pledge.status, 'ARRIVED'); assert.ok(arrived.json.data.pledge.arrivedAt);
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/arrive`, {}, write(p.token))).json.error.code, 'INVALID_PLEDGE_STATE');
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/cancel`, {}, write(p.token))).json.error.code, 'INVALID_PLEDGE_STATE');
});

test('request state and wall-clock expiry block pledge, arrival, and location sharing', async () => {
  const expired = await scenario('past-pledge');
  getDb().prepare("UPDATE requests SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(expired.requestId);
  const ea = await logged(expired.donors[0].user);
  assert.equal((await ea.client.post(`/api/donor/alerts/${expired.alerts[0].id}/pledge`, {}, write(ea.token))).json.error.code, 'REQUEST_EXPIRED');
  for (const state of ['COVERED','COMPLETED','CANCELLED','EXPIRED']) {
    getDb().prepare('UPDATE requests SET status=?,expires_at=? WHERE id=?').run(state, new Date(Date.now()+60000).toISOString(), expired.requestId);
    assert.equal((await ea.client.post(`/api/donor/alerts/${expired.alerts[0].id}/pledge`, {}, write(ea.token))).status, 409);
  }
  const active = await scenario('past-actions'); const p = await pledgeAs(active.donors[0], active.alerts[0].id);
  getDb().prepare("UPDATE requests SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(active.requestId);
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/arrive`, {}, write(p.token))).json.error.code, 'REQUEST_EXPIRED');
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23, longitude: 72 }, write(p.token))).json.error.code, 'REQUEST_EXPIRED');
});

test('location sharing validates, overwrites one row, refreshes TTL, and DELETE physically removes it', async () => {
  const s = await scenario('location', { donorCount: 2 }); const p = await pledgeAs(s.donors[0], s.alerts[0].id);
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23, longitude: 72 }, { headers: { Origin: ORIGIN } })).status, 403);
  assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23, longitude: 72 }, write(p.token, 'http://evil.test'))).status, 403);
  for (const body of [{latitude:91,longitude:0},{latitude:-91,longitude:0},{latitude:0,longitude:181},{latitude:0,longitude:-181},{latitude:'23',longitude:72},{latitude:null,longitude:72},{latitude:Infinity,longitude:72}]) {
    assert.equal((await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, body, write(p.token))).status, 400);
  }
  let response = await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(p.token));
  assert.equal(response.status, 200); assert.equal(response.json.data.location.isSharing, true);
  const first = getDb().prepare('SELECT * FROM donor_location_sessions WHERE pledge_id=?').get(p.pledge.id);
  getDb().prepare("UPDATE donor_location_sessions SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(first.id);
  response = await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23.05, longitude: 72.58 }, write(p.token));
  const updated = getDb().prepare('SELECT * FROM donor_location_sessions WHERE pledge_id=?').get(p.pledge.id);
  assert.equal(updated.id, first.id); assert.equal(updated.latitude, 23.05); assert.ok(Date.parse(updated.expires_at) > Date.now());
  const other = await logged(s.donors[1].user);
  assert.equal((await other.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 1, longitude: 1 }, write(other.token))).status, 404);
  assert.equal((await other.client.del(`/api/donor/pledges/${p.pledge.id}/location`, write(other.token))).status, 404);
  assert.equal((await p.client.del(`/api/donor/pledges/${p.pledge.id}/location`, { headers: { Origin: ORIGIN } })).status, 403);
  assert.equal((await p.client.del(`/api/donor/pledges/${p.pledge.id}/location`, write(p.token))).status, 200);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(p.pledge.id).n, 0);
  const noPledge = await other.client.post('/api/donor/pledges/999999/location', { latitude: 1, longitude: 1 }, write(other.token));
  assert.equal(noPledge.status, 404);
});

test('hospital sees request-bound pseudonyms and coarse ETA bands only', async () => {
  const s = await scenario('eta-private'); const p = await pledgeAs(s.donors[0], s.alerts[0].id);
  let list = await s.client.get(`/api/requests/${s.requestId}/pledges`);
  assert.equal(list.status, 200); assert.equal(list.json.data.pledges[0].etaBand, null);
  await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(p.token));
  list = await s.client.get(`/api/requests/${s.requestId}/pledges`);
  assert.match(list.json.data.pledges[0].etaBand, /min$/); assert.match(list.json.data.pledges[0].distanceBand, /km$/);
  const text = JSON.stringify(list.json.data).toLowerCase();
  for (const forbidden of ['donorid','userid','displayname','phone','email','latitude','longitude','rawdistance','raweta','exactdistance','exacteta']) assert.equal(text.includes(forbidden), false, forbidden);
  const otherHospital = await createHospital({ email: 'eta-other-hospital@m6.test' }); const other = await logged(otherHospital.user);
  assert.equal((await other.client.get(`/api/requests/${s.requestId}/pledges`)).status, 404);
  const otherDonor = await createDonor({ email: 'eta-other-donor@m6.test' }); const oda = await logged(otherDonor.user);
  assert.equal((await oda.client.get(`/api/donor/pledges/${p.pledge.id}`)).status, 404);
  getDb().prepare("UPDATE donor_location_sessions SET expires_at='2000-01-01T00:00:00Z' WHERE pledge_id=?").run(p.pledge.id);
  list = await s.client.get(`/api/requests/${s.requestId}/pledges`);
  assert.equal(list.json.data.pledges[0].etaBand, null); assert.equal(list.json.data.pledges[0].distanceBand, null);
});

test('missing hospital coordinates safely produces no ETA', async () => {
  const s = await scenario('eta-missing', { hospitalCoordinates: false }); const p = await pledgeAs(s.donors[0], s.alerts[0].id);
  await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(p.token));
  const pledge = (await s.client.get(`/api/requests/${s.requestId}/pledges`)).json.data.pledges[0];
  assert.equal(pledge.etaBand, null); assert.equal(pledge.distanceBand, null);
});

test('public references are unique and different for the same donor across requests', async () => {
  const s = await scenario('references'); const first = await pledgeAs(s.donors[0], s.alerts[0].id);
  const made = await s.client.post('/api/requests', requestPayload({ unitsNeeded: 1 }), write(s.token));
  const secondRequest = made.json.data.request.id;
  await s.client.post(`/api/requests/${secondRequest}/donor-fallback`, {}, write(s.token));
  const secondAlert = getDb().prepare('SELECT id FROM donor_alerts WHERE request_id=? AND donor_id=?').get(secondRequest, s.donors[0].donor.id);
  const second = await first.client.post(`/api/donor/alerts/${secondAlert.id}/pledge`, {}, write(first.token));
  assert.equal(second.status, 201); assert.notEqual(first.pledge.publicReference, second.json.data.pledge.publicReference);
  assert.notEqual(first.pledge.publicReference, `DONOR-${s.donors[0].donor.id}`);
});

test('bank coverage defers pledged donors and deletes temporary location', async () => {
  const s = await scenario('bank-defers', { units: 1, donorCount: 1, bankStock: 1 }); const p = await pledgeAs(s.donors[0], s.alerts[0].id);
  await p.client.post(`/api/donor/pledges/${p.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(p.token));
  const bank = await logged(s.bank.user); assert.equal((await bank.client.post(`/api/requests/${s.requestId}/allocate`, {}, write(bank.token))).status, 201);
  assert.equal(getDb().prepare('SELECT status FROM donor_pledges WHERE id=?').get(p.pledge.id).status, 'DEFERRED');
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(p.pledge.id).n, 0);
  assert.equal(getDb().prepare('SELECT status FROM requests WHERE id=?').get(s.requestId).status, 'COVERED');
});

test('request cancellation and completion close pledges and delete exact location', async () => {
  const cancelled = await scenario('request-cancel'); const cp = await pledgeAs(cancelled.donors[0], cancelled.alerts[0].id);
  await cp.client.post(`/api/donor/pledges/${cp.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(cp.token));
  await cancelled.client.post(`/api/requests/${cancelled.requestId}/cancel`, {}, write(cancelled.token));
  assert.equal(getDb().prepare('SELECT status FROM donor_pledges WHERE id=?').get(cp.pledge.id).status, 'CLOSED');
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(cp.pledge.id).n, 0);

  const completed = await scenario('request-complete', { units: 1, bankStock: 1 }); const pp = await pledgeAs(completed.donors[0], completed.alerts[0].id);
  await pp.client.post(`/api/donor/pledges/${pp.pledge.id}/location`, { latitude: 23.04, longitude: 72.57 }, write(pp.token));
  const bank = await logged(completed.bank.user); await bank.client.post(`/api/requests/${completed.requestId}/allocate`, {}, write(bank.token));
  await completed.client.post(`/api/requests/${completed.requestId}/complete`, {}, write(completed.token));
  assert.equal(getDb().prepare('SELECT status FROM donor_pledges WHERE id=?').get(pp.pledge.id).status, 'CLOSED');
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM donor_location_sessions WHERE pledge_id=?').get(pp.pledge.id).n, 0);
});

test('pledges do not alter bank allocations, inventory, or bank-defined COVERED state', async () => {
  const s = await scenario('separate-coverage', { units: 1 }); const before = getDb().prepare('SELECT COUNT(*) n FROM request_allocations WHERE request_id=?').get(s.requestId).n;
  await pledgeAs(s.donors[0], s.alerts[0].id);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM request_allocations WHERE request_id=?').get(s.requestId).n, before);
  assert.equal(getDb().prepare('SELECT status FROM requests WHERE id=?').get(s.requestId).status, 'OPEN');
});
