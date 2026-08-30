'use strict';

require('../helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

before(async () => {
  srv = await startTestServer();
});
after(async () => {
  await srv.close();
  closeDatabase();
});

test('F: replaying the same clientRequestId + payload returns the existing request, one row only', async () => {
  const { user, hospital } = await createHospital({ email: 'f-idem@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const payload = requestPayload();

  const first = await c.post('/api/requests', payload, write(token));
  const second = await c.post('/api/requests', payload, write(token));
  const third = await c.post('/api/requests', payload, write(token));

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(third.status, 200);
  assert.equal(second.json.data.idempotentReplay, true);
  assert.equal(first.json.data.request.id, second.json.data.request.id);
  assert.equal(first.json.data.request.id, third.json.data.request.id);

  const rows = getDb()
    .prepare('SELECT COUNT(*) AS n FROM requests WHERE hospital_id = ? AND client_request_id = ?')
    .get(hospital.id, payload.clientRequestId);
  assert.equal(rows.n, 1);

  // Replays must NOT create extra broadcast rows.
  const broadcasts = getDb()
    .prepare('SELECT COUNT(*) AS n FROM request_broadcasts WHERE request_id = ?')
    .get(first.json.data.request.id);
  assert.equal(broadcasts.n, first.json.data.broadcast.bankCount);
});

test('G: same clientRequestId with different details -> 409 IDEMPOTENCY_CONFLICT, original unchanged', async () => {
  const { user } = await createHospital({ email: 'g-conflict@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, user);
  const id = crypto.randomUUID();

  const original = await c.post('/api/requests', requestPayload({ clientRequestId: id, unitsNeeded: 2, urgency: 'NORMAL' }), write(token));
  assert.equal(original.status, 201);

  for (const patch of [{ unitsNeeded: 5 }, { urgency: 'CRITICAL' }, { bloodGroup: 'A+' }]) {
    // eslint-disable-next-line no-await-in-loop
    const conflict = await c.post('/api/requests', requestPayload({ clientRequestId: id, unitsNeeded: 2, urgency: 'NORMAL', ...patch }), write(token));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.json.error.code, 'IDEMPOTENCY_CONFLICT');
  }

  const check = await c.get(`/api/requests/${original.json.data.request.id}`);
  assert.equal(check.json.data.request.unitsNeeded, 2);
  assert.equal(check.json.data.request.urgency, 'NORMAL');
});

test('H: idempotency is scoped per hospital - two hospitals may share a clientRequestId', async () => {
  const a = await createHospital({ email: 'h-a@m3.test' });
  const b = await createHospital({ email: 'h-b@m3.test' });
  const ca = srv.client();
  const cb = srv.client();
  const ta = await loginAs(ca, a.user);
  const tb = await loginAs(cb, b.user);

  const sharedId = crypto.randomUUID();
  const ra = await ca.post('/api/requests', requestPayload({ clientRequestId: sharedId }), write(ta));
  const rb = await cb.post('/api/requests', requestPayload({ clientRequestId: sharedId }), write(tb));

  assert.equal(ra.status, 201);
  assert.equal(rb.status, 201);
  assert.notEqual(ra.json.data.request.id, rb.json.data.request.id);
  assert.equal(ra.json.data.request.hospitalId, a.hospital.id);
  assert.equal(rb.json.data.request.hospitalId, b.hospital.id);
});
