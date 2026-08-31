'use strict';

/**
 * E2E A — hospital request → multi-bank atomic allocation → COVERED.
 *
 * Proves the whole Module 03 + 04 + 07 + 08 chain works together over real
 * HTTP: create request, both banks reserve, request COVERED, hospital sees
 * allocations, notification outbox rows exist, audit rows exist.
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });

async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('E2E A: hospital request is covered by two banks and is visible to the hospital', async () => {
  const db = getDb();
  const bankA = await createBank({ email: 'e2e-a-bank-a@example.test' });
  const bankB = await createBank({ email: 'e2e-a-bank-b@example.test' });
  db.prepare("UPDATE inventory SET units_available=1 WHERE bank_id=? AND blood_group='O-'").run(bankA.bank.id);
  db.prepare("UPDATE inventory SET units_available=5 WHERE bank_id=? AND blood_group='O-'").run(bankB.bank.id);

  const hospital = await createHospital({ email: 'e2e-a-hospital@example.test' });
  const h = await loggedIn(hospital.user);
  const created = await h.client.post('/api/requests', requestPayload({ unitsNeeded: 3, note: 'PATIENT NOTE — private' }), write(h.token));
  assert.equal(created.status, 201);
  const requestId = created.json.data.request.id;

  // Bank A reserves its 1 unit.
  const a = await loggedIn(bankA.user);
  const ra = await a.client.post(`/api/requests/${requestId}/allocate`, {}, write(a.token));
  assert.equal(ra.status, 201);

  // Bank B reserves the remaining 2.
  const b = await loggedIn(bankB.user);
  const rb = await b.client.post(`/api/requests/${requestId}/allocate`, {}, write(b.token));
  assert.equal(rb.status, 201);

  // Request is now COVERED.
  const detail = await h.client.get(`/api/requests/${requestId}`, write(h.token));
  assert.equal(detail.json.data.request.status, 'COVERED');

  // Hospital sees exactly two allocations totalling 3 units, no donor identity.
  const allocs = await h.client.get(`/api/requests/${requestId}/allocations`, write(h.token));
  assert.equal(allocs.status, 200);
  const list = allocs.json.data.allocations;
  assert.equal(list.length, 2);
  assert.equal(list.reduce((s, x) => s + x.unitsReserved, 0), 3);
  const blob = JSON.stringify(allocs.json).toLowerCase();
  for (const leak of ['phone', 'password', 'latitude', 'longitude', 'patient note']) {
    assert.ok(!blob.includes(leak), `allocation view must not leak ${leak}`);
  }

  // Inventory decremented by exactly 3 in total; nothing negative.
  const remaining = db.prepare("SELECT COALESCE(SUM(units_available),0) n FROM inventory WHERE bank_id IN (?,?) AND blood_group='O-'").get(bankA.bank.id, bankB.bank.id).n;
  assert.equal(remaining, 6 - 3);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory WHERE units_available < 0').get().n, 0);

  // Notification outbox + audit rows were written for the domain events.
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE event_type='BANK_ALLOCATION_RESERVED'").get().n >= 2);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='ALLOCATION_RESERVED'").get().n >= 2);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='REQUEST_CREATED' AND entity_id=?").get(requestId).n === 1);
});
