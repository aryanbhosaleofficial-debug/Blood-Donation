'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createTestUser } = require('../helpers/users');
const { createHospital, createBank, requestPayload } = require('../helpers/orgs');
const { closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function hospitalWithRequest(email) {
  const org = await createHospital({ email });
  const client = srv.client();
  const token = await loginAs(client, org.user);
  const created = await client.post('/api/requests', requestPayload(), write(token));
  return { org, client, token, requestId: created.json.data.request.id };
}

before(async () => {
  srv = await startTestServer();
});
after(async () => {
  await srv.close();
  closeDatabase();
});

test('I: a hospital cannot read another hospital request (404, not 403)', async () => {
  const a = await hospitalWithRequest('i-a@m3.test');
  const b = await hospitalWithRequest('i-b@m3.test');

  const cross = await b.client.get(`/api/requests/${a.requestId}`);
  assert.equal(cross.status, 404);
  assert.equal(cross.json.error.code, 'REQUEST_NOT_FOUND');

  // and its own request is reachable
  assert.equal((await a.client.get(`/api/requests/${a.requestId}`)).status, 200);
});

test('I: a hospital cannot cancel/complete another hospital request', async () => {
  const a = await hospitalWithRequest('i-mut-a@m3.test');
  const b = await hospitalWithRequest('i-mut-b@m3.test');

  assert.equal((await b.client.post(`/api/requests/${a.requestId}/cancel`, {}, write(b.token))).status, 404);
  assert.equal((await b.client.post(`/api/requests/${a.requestId}/complete`, {}, write(b.token))).status, 404);
  assert.equal((await a.client.get(`/api/requests/${a.requestId}`)).json.data.request.status, 'OPEN');
});

test('J: request list is scoped to the calling hospital, newest first', async () => {
  const a = await createHospital({ email: 'j-a@m3.test' });
  const b = await createHospital({ email: 'j-b@m3.test' });
  const ca = srv.client();
  const cb = srv.client();
  const ta = await loginAs(ca, a.user);
  const tb = await loginAs(cb, b.user);

  const idsA = [];
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ca.post('/api/requests', requestPayload(), write(ta));
    idsA.push(r.json.data.request.id);
  }
  await cb.post('/api/requests', requestPayload(), write(tb));

  const listA = await ca.get('/api/requests');
  assert.equal(listA.status, 200);
  const returnedA = listA.json.data.requests.map((r) => r.id);
  assert.deepEqual(new Set(returnedA), new Set(idsA));
  // newest first
  assert.deepEqual(returnedA, [...returnedA].sort((x, y) => y - x));

  const listB = await cb.get('/api/requests');
  assert.equal(listB.json.data.requests.length, 1);
  assert.equal(returnedA.includes(listB.json.data.requests[0].id), false);
});

test('J: ?status= filter is honoured and query is not trusted for hospitalId', async () => {
  const a = await hospitalWithRequest('j-filter-a@m3.test');
  await a.client.post(`/api/requests/${a.requestId}/cancel`, {}, write(a.token));
  await a.client.post('/api/requests', requestPayload(), write(a.token)); // a second OPEN one

  const open = await a.client.get('/api/requests?status=OPEN');
  assert.ok(open.json.data.requests.every((r) => r.status === 'OPEN'));
  const cancelled = await a.client.get('/api/requests?status=CANCELLED');
  assert.ok(cancelled.json.data.requests.every((r) => r.status === 'CANCELLED'));

  // hospitalId query param must be ignored (strict schema rejects it)
  const bogus = await a.client.get('/api/requests?hospitalId=999');
  assert.equal(bogus.status, 400);
});

test('admin may read any request (read-only oversight)', async () => {
  const a = await hospitalWithRequest('admin-view-a@m3.test');
  const admin = await createTestUser({ email: 'admin-view@m3.test', role: 'ADMIN' });
  const ac = srv.client();
  const at = await loginAs(ac, admin);

  const detail = await ac.get(`/api/requests/${a.requestId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.data.request.id, a.requestId);

  const all = await ac.get('/api/requests');
  assert.equal(all.status, 200);
  assert.ok(all.json.data.requests.some((r) => r.id === a.requestId));

  // admin cannot mutate through the hospital lifecycle endpoints
  assert.equal((await ac.post(`/api/requests/${a.requestId}/cancel`, {}, write(at))).status, 403);
});

test('DONOR has no request access in Module 03', async () => {
  const a = await hospitalWithRequest('donor-block-a@m3.test');
  const donor = await createTestUser({ email: 'donor-block@m3.test', role: 'DONOR', isVerified: 1 });
  const dc = srv.client();
  await loginAs(dc, donor);
  assert.equal((await dc.get('/api/requests')).status, 403);
  assert.equal((await dc.get(`/api/requests/${a.requestId}`)).status, 403);
});
