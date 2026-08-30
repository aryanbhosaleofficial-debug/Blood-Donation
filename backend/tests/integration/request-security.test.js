'use strict';

require('../helpers/env');

const fs = require('node:fs');
const path = require('node:path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function verifiedHospital(email) {
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

test('D: request create / cancel / complete without CSRF or with a bad Origin -> 403', async () => {
  const h = await verifiedHospital('d-csrf@m3.test');
  const created = await h.client.post('/api/requests', requestPayload(), write(h.token));
  const id = created.json.data.request.id;

  // no token
  assert.equal((await h.client.post('/api/requests', requestPayload(), { headers: { Origin: ORIGIN } })).status, 403);
  assert.equal((await h.client.post(`/api/requests/${id}/cancel`, {}, { headers: { Origin: ORIGIN } })).status, 403);
  assert.equal((await h.client.post(`/api/requests/${id}/complete`, {}, { headers: { Origin: ORIGIN } })).status, 403);

  // wrong Origin
  assert.equal(
    (await h.client.post('/api/requests', requestPayload(), { headers: { Origin: 'http://evil.example', 'X-CSRF-Token': h.token } })).status,
    403,
  );

  // valid -> allowed
  assert.equal((await h.client.post('/api/requests', requestPayload(), write(h.token))).status, 201);
});

test('E: malformed create payloads are rejected over HTTP with 400 VALIDATION_ERROR', async () => {
  const h = await verifiedHospital('e-validation@m3.test');
  const cases = [
    { clientRequestId: 'not-a-uuid', bloodGroup: 'O-', component: 'RED_CELLS', unitsNeeded: 1, urgency: 'NORMAL' },
    { ...requestPayload(), bloodGroup: 'XY' },
    { ...requestPayload(), component: 'PLASMA' },
    { ...requestPayload(), unitsNeeded: 0 },
    { ...requestPayload(), unitsNeeded: -2 },
    { ...requestPayload(), unitsNeeded: 2.5 },
    { ...requestPayload(), unitsNeeded: 999 },
    { ...requestPayload(), urgency: 'WHENEVER' },
    { ...requestPayload(), note: 'x'.repeat(501) },
    { ...requestPayload(), hospitalId: 5 },
  ];
  for (const body of cases) {
    // eslint-disable-next-line no-await-in-loop
    const res = await h.client.post('/api/requests', body, write(h.token));
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.json.error.code, 'VALIDATION_ERROR');
    assert.equal('stack' in res.json.error, false);
  }
});

test('E: a non-numeric :requestId path param is a 400', async () => {
  const h = await verifiedHospital('e-param@m3.test');
  assert.equal((await h.client.get('/api/requests/not-a-number')).status, 400);
});

test('U: an XSS payload in a note is stored and returned verbatim as data (no HTML execution server-side)', async () => {
  const h = await verifiedHospital('u-xss@m3.test');
  const note = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const created = await h.client.post('/api/requests', requestPayload({ note }), write(h.token));
  assert.equal(created.status, 201);
  assert.equal(created.json.data.request.note, note);

  const detail = await h.client.get(`/api/requests/${created.json.data.request.id}`);
  assert.equal(detail.json.data.request.note, note);
  // response is application/json, not html
  assert.match(detail.headers.get('content-type'), /application\/json/);
});

test('U: the frontend never assigns innerHTML / insertAdjacentHTML for dynamic data', () => {
  const dir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src');
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const src = fs.readFileSync(full, 'utf8');
        if (/\.innerHTML\s*=/.test(src) || /insertAdjacentHTML/.test(src)) offenders.push(full);
      }
    }
  };
  walk(dir);
  assert.deepEqual(offenders, []);
});

test('W: Module 02 inventory still works alongside requests', async () => {
  const bank = await createBank({ email: 'w-bank@m3.test' });
  const c = srv.client();
  const token = await loginAs(c, bank.user);
  const inv = await c.get('/api/blood-bank/inventory');
  assert.equal(inv.status, 200);
  assert.equal(inv.json.data.inventory.length, 8);
  const item = inv.json.data.inventory[0];
  const upd = await c.patch(`/api/blood-bank/inventory/${item.id}`, { unitsAvailable: 4, expectedVersion: 0, reason: 'Count' }, write(token));
  assert.equal(upd.status, 200);
  assert.equal(upd.json.data.inventory.version, 1);
});

test('X: Module 01 auth/session/CSRF still work', async () => {
  const h = await verifiedHospital('x-auth@m3.test');
  assert.equal((await h.client.get('/api/auth/me')).json.data.user.email, h.org.user.email);
  const logout = await h.client.post('/api/auth/logout', {}, write(h.token));
  assert.equal(logout.status, 200);
  assert.equal((await h.client.get('/api/auth/me')).status, 401);
});

test('Y: Module 00 health + pragmas still hold', async () => {
  const res = await srv.client().get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.data.status, 'ok');
  assert.equal(res.json.data.schemaVersion, '3');
  const db = getDb();
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(String(db.pragma('journal_mode', { simple: true })).toLowerCase(), 'wal');
});

test('the request+broadcast write is transactional: a broadcast-insert failure rolls back the request', async () => {
  await createBank({ email: 'txn-bank@m3.test' });
  const h = await verifiedHospital('txn-hospital@m3.test');

  getDb().exec(
    "CREATE TEMP TRIGGER fail_broadcast BEFORE INSERT ON request_broadcasts BEGIN SELECT RAISE(ABORT, 'boom'); END;",
  );
  const before = getDb().prepare('SELECT COUNT(*) AS n FROM requests').get().n;
  const res = await h.client.post('/api/requests', requestPayload(), write(h.token));
  getDb().exec('DROP TRIGGER fail_broadcast');

  assert.equal(res.status, 500);
  const afterCount = getDb().prepare('SELECT COUNT(*) AS n FROM requests').get().n;
  assert.equal(afterCount, before, 'request row must have been rolled back');
});
