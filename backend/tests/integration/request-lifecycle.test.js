'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function setup(email) {
  await createBank({ email: `${email}-bank` }); // an eligible bank so broadcasts exist
  const org = await createHospital({ email });
  const client = srv.client();
  const token = await loginAs(client, org.user);
  const created = await client.post('/api/requests', requestPayload(), write(token));
  return { client, token, requestId: created.json.data.request.id };
}

before(async () => {
  srv = await startTestServer();
});
after(async () => {
  await srv.close();
  closeDatabase();
});

test('K: OPEN -> CANCELLED sets closed_at and closes broadcast rows', async () => {
  const { client, token, requestId } = await setup('k-cancel@m3.test');
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM request_broadcasts WHERE request_id = ? AND status <> ?').get(requestId, 'CLOSED');
  assert.ok(before.n >= 1);

  const res = await client.post(`/api/requests/${requestId}/cancel`, {}, write(token));
  assert.equal(res.status, 200);
  assert.equal(res.json.data.request.status, 'CANCELLED');
  assert.ok(res.json.data.request.closedAt);

  const open = getDb().prepare('SELECT COUNT(*) AS n FROM request_broadcasts WHERE request_id = ? AND status <> ?').get(requestId, 'CLOSED');
  assert.equal(open.n, 0);
});

test('K: CANCELLED -> CANCELLED and COMPLETED -> CANCELLED are rejected with 409 INVALID_REQUEST_STATE', async () => {
  const { client, token, requestId } = await setup('k-invalid@m3.test');
  await client.post(`/api/requests/${requestId}/cancel`, {}, write(token));

  const again = await client.post(`/api/requests/${requestId}/cancel`, {}, write(token));
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'INVALID_REQUEST_STATE');

  const complete = await client.post(`/api/requests/${requestId}/complete`, {}, write(token));
  assert.equal(complete.status, 409);
});

test('L: OPEN cannot complete until covered', async () => {
  const { client, token, requestId } = await setup('l-complete@m3.test');
  const res = await client.post(`/api/requests/${requestId}/complete`, {}, write(token));
  assert.equal(res.status, 409);
  assert.equal(res.json.error.code, 'REQUEST_NOT_COVERED');
});

test('L: COVERED -> COMPLETED closes the request; repeat is rejected', async () => {
  const { client, token, requestId } = await setup('l-repeat@m3.test');
  getDb().prepare("UPDATE requests SET status='COVERED' WHERE id=?").run(requestId);
  const first=await client.post(`/api/requests/${requestId}/complete`, {}, write(token));
  assert.equal(first.status,200);
  const again = await client.post(`/api/requests/${requestId}/complete`, {}, write(token));
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'INVALID_REQUEST_STATE');
});

test('no hospital button/endpoint sets COVERED directly', async () => {
  const { client, token, requestId } = await setup('no-covered@m3.test');
  // there simply is no such route
  const res = await client.post(`/api/requests/${requestId}/cover`, {}, write(token));
  assert.equal(res.status, 404);
  assert.equal((await client.get(`/api/requests/${requestId}`)).json.data.request.status, 'OPEN');
});

test('cancel/complete on a missing request id is 404 REQUEST_NOT_FOUND', async () => {
  const { client, token } = await setup('missing@m3.test');
  assert.equal((await client.post('/api/requests/999999/cancel', {}, write(token))).status, 404);
});
