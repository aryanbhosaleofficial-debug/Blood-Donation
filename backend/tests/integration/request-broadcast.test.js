'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { createHospital, createBank, setVerified, setActive, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function hospitalClient(email) {
  const org = await createHospital({ email });
  const client = srv.client();
  const token = await loginAs(client, org.user);
  return { org, client, token };
}

before(async () => {
  srv = await startTestServer();
});
after(async () => {
  await srv.close();
  closeDatabase();
});

test('M: broadcast targets only currently-verified, active blood banks', async () => {
  const verifiedBanks = [
    await createBank({ email: 'm-b1@m3.test' }),
    await createBank({ email: 'm-b2@m3.test' }),
    await createBank({ email: 'm-b3@m3.test' }),
  ];
  await createBank({ email: 'm-unverified@m3.test', verified: false });
  const inactive = await createBank({ email: 'm-inactive@m3.test' });
  setActive(inactive.user.id, false);

  const h = await hospitalClient('m-hospital@m3.test');
  const res = await h.client.post('/api/requests', requestPayload(), write(h.token));
  assert.equal(res.status, 201);
  assert.equal(res.json.data.broadcast.bankCount, 3);

  const rows = getDb()
    .prepare('SELECT bank_id FROM request_broadcasts WHERE request_id = ? ORDER BY bank_id')
    .all(res.json.data.request.id);
  assert.deepEqual(rows.map((r) => r.bank_id).sort(), verifiedBanks.map((b) => b.bank.id).sort());
});

test('N: zero eligible banks still creates a valid request with zero broadcasts', async () => {
  // fresh temp db per file, but other tests in this file create banks; make a
  // hospital and immediately deactivate every bank first.
  for (const row of getDb().prepare("SELECT user_id FROM blood_banks").all()) {
    setVerified(row.user_id, false);
  }
  const h = await hospitalClient('n-hospital@m3.test');
  const res = await h.client.post('/api/requests', requestPayload(), write(h.token));
  assert.equal(res.status, 201);
  assert.equal(res.json.data.broadcast.bankCount, 0);
  assert.equal(res.json.data.request.status, 'OPEN');
  const n = getDb().prepare('SELECT COUNT(*) AS n FROM request_broadcasts WHERE request_id = ?').get(res.json.data.request.id);
  assert.equal(n.n, 0);
  // restore for later tests is unnecessary - process-isolated file
});

test('O: broadcast rows are unique per (request, bank)', async () => {
  await createBank({ email: 'o-bank@m3.test' });
  const h = await hospitalClient('o-hospital@m3.test');
  const payload = requestPayload();
  await h.client.post('/api/requests', payload, write(h.token));
  await h.client.post('/api/requests', payload, write(h.token)); // idempotent replay

  const dupes = getDb()
    .prepare(
      `SELECT request_id, bank_id, COUNT(*) AS n
         FROM request_broadcasts GROUP BY request_id, bank_id HAVING n > 1`,
    )
    .all();
  assert.deepEqual(dupes, []);
});

test('P: a bank only sees requests broadcast to it', async () => {
  const bankA = await createBank({ email: 'p-bankA@m3.test' });
  const bankB = await createBank({ email: 'p-bankB@m3.test' });
  const h = await hospitalClient('p-hospital@m3.test');
  const created = await h.client.post('/api/requests', requestPayload(), write(h.token));
  const requestId = created.json.data.request.id;

  // Remove the broadcast row to bank B so only A can see it.
  getDb().prepare('DELETE FROM request_broadcasts WHERE request_id = ? AND bank_id = ?').run(requestId, bankB.bank.id);

  const ca = srv.client();
  await loginAs(ca, bankA.user);
  const listA = await ca.get('/api/blood-bank/requests');
  assert.equal(listA.status, 200);
  assert.ok(listA.json.data.requests.some((r) => r.id === requestId));
  // bank view carries facility context but not hospitalId / synthetic flags
  const seen = listA.json.data.requests.find((r) => r.id === requestId);
  assert.ok(seen.hospital && seen.hospital.name);
  assert.equal('hospitalId' in seen, false);

  const cb = srv.client();
  await loginAs(cb, bankB.user);
  const listB = await cb.get('/api/blood-bank/requests');
  assert.equal(listB.json.data.requests.some((r) => r.id === requestId), false);
});

test('P: bank incoming list is ordered CRITICAL, then URGENT, then NORMAL', async () => {
  const bank = await createBank({ email: 'p-order-bank@m3.test' });
  const h = await hospitalClient('p-order-hospital@m3.test');
  await h.client.post('/api/requests', requestPayload({ urgency: 'NORMAL' }), write(h.token));
  await h.client.post('/api/requests', requestPayload({ urgency: 'CRITICAL' }), write(h.token));
  await h.client.post('/api/requests', requestPayload({ urgency: 'URGENT' }), write(h.token));

  const c = srv.client();
  await loginAs(c, bank.user);
  const list = await c.get('/api/blood-bank/requests');
  const urgencies = list.json.data.requests.map((r) => r.urgency);
  const rank = { CRITICAL: 0, URGENT: 1, NORMAL: 2 };
  assert.deepEqual(urgencies, [...urgencies].sort((a, b) => rank[a] - rank[b]));
});

test('Q: a bank cannot read a request it was never broadcast (404)', async () => {
  const bankA = await createBank({ email: 'q-bankA@m3.test' });
  const bankB = await createBank({ email: 'q-bankB@m3.test' });
  const h = await hospitalClient('q-hospital@m3.test');
  const created = await h.client.post('/api/requests', requestPayload(), write(h.token));
  const requestId = created.json.data.request.id;
  getDb().prepare('DELETE FROM request_broadcasts WHERE request_id = ? AND bank_id = ?').run(requestId, bankB.bank.id);

  const cb = srv.client();
  await loginAs(cb, bankB.user);
  const res = await cb.get(`/api/blood-bank/requests/${requestId}`);
  assert.equal(res.status, 404);
  assert.equal(res.json.error.code, 'REQUEST_NOT_FOUND');

  // bank A (still broadcast) can read it
  const ca = srv.client();
  await loginAs(ca, bankA.user);
  assert.equal((await ca.get(`/api/blood-bank/requests/${requestId}`)).status, 200);
});

test('R: revoking a bank verification blocks polling immediately on the same session', async () => {
  const bank = await createBank({ email: 'r-bank@m3.test' });
  const h = await hospitalClient('r-hospital@m3.test');
  await h.client.post('/api/requests', requestPayload(), write(h.token));

  const c = srv.client();
  await loginAs(c, bank.user);
  assert.equal((await c.get('/api/blood-bank/requests')).status, 200);

  setVerified(bank.user.id, false); // admin revokes; same cookie kept
  const after = await c.get('/api/blood-bank/requests');
  assert.equal(after.status, 403);
  assert.equal(after.json.error.code, 'ORGANIZATION_NOT_VERIFIED');
});

test('V: polling the incoming endpoint is read-only (no mutation, no new rows)', async () => {
  await createBank({ email: 'v-bank@m3.test' });
  const bank = await createBank({ email: 'v-bank2@m3.test' });
  const h = await hospitalClient('v-hospital@m3.test');
  const created = await h.client.post('/api/requests', requestPayload(), write(h.token));
  const requestId = created.json.data.request.id;

  const snapshot = () => ({
    request: getDb().prepare('SELECT status, expires_at, created_at FROM requests WHERE id = ?').get(requestId),
    broadcasts: getDb().prepare('SELECT id, status, responded_at FROM request_broadcasts WHERE request_id = ? ORDER BY id').all(requestId),
    count: getDb().prepare('SELECT COUNT(*) AS n FROM request_broadcasts').get().n,
  });

  const c = srv.client();
  await loginAs(c, bank.user);
  const before = snapshot();
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await c.get('/api/blood-bank/requests');
    // eslint-disable-next-line no-await-in-loop
    await c.get(`/api/blood-bank/requests/${requestId}`);
  }
  assert.deepEqual(snapshot(), before);
});
