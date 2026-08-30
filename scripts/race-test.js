'use strict';

// Isolated viva/demo race: creates random test-only credentials in a temporary
// SQLite database, uses real HTTP sessions/CSRF, and never touches app.db.
require('../backend/tests/helpers/env');

const crypto = require('node:crypto');
const { startTestServer, loginAs, ORIGIN } = require('../backend/tests/helpers/server');
const { createHospital, createBank, requestPayload } = require('../backend/tests/helpers/orgs');
const { getDb, closeDatabase } = require('../backend/src/core/database');

const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function main() {
  const srv = await startTestServer();
  try {
    const password = crypto.randomBytes(18).toString('base64url');
    const banks = [];
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const org = await createBank({ email: `race-bank-${i}-${crypto.randomUUID()}@example.test`, password });
      getDb().prepare("UPDATE inventory SET units_available=2 WHERE bank_id=? AND blood_group='O-'").run(org.bank.id);
      const client = srv.client();
      // eslint-disable-next-line no-await-in-loop
      const token = await loginAs(client, org.user);
      banks.push({ ...org, client, token });
    }
    const hospital = await createHospital({ email: `race-hospital-${crypto.randomUUID()}@example.test`, password });
    const hc = srv.client();
    const ht = await loginAs(hc, hospital.user);
    const created = await hc.post('/api/requests', requestPayload({ unitsNeeded: 1 }), write(ht));
    const requestId = created.json.data.request.id;
    const results = await Promise.all(banks.map((b) => b.client.post(`/api/requests/${requestId}/allocate`, {}, write(b.token))));
    results.forEach((r, index) => console.log(`Bank ${index + 1}: HTTP ${r.status} ${r.json?.error?.code || 'ALLOCATED'}`));
    const allocated = getDb().prepare("SELECT COALESCE(SUM(units_reserved),0) n FROM request_allocations WHERE request_id=? AND status IN ('RESERVED','COMPLETED')").get(requestId).n;
    const inventory = getDb().prepare("SELECT SUM(units_available) n FROM inventory WHERE bank_id IN (?,?,?,?,?) AND blood_group='O-'").get(...banks.map((b) => b.bank.id)).n;
    const status = getDb().prepare('SELECT status FROM requests WHERE id=?').get(requestId).status;
    console.log(`Final request: status=${status}, allocated=${allocated}, matching inventory total=${inventory}`);
    if (allocated !== 1 || inventory !== 9 || status !== 'COVERED') throw new Error('Race invariant failed');
    console.log('PASS: exactly one unit reserved; no over-allocation.');
  } finally {
    await srv.close();
    closeDatabase();
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
