'use strict';

/**
 * Allocation concurrency race (viva/demo proof).
 *
 * Isolated: test-only credentials in a temporary SQLite database, real HTTP
 * sessions/CSRF, never touches app.db or any secret.
 *
 *   npm run race-test              # 1-unit + 3-unit scenario, 1 round each
 *   node scripts/race-test.js --rounds 10   # repeat both scenarios 10x
 *
 * Invariant: SUM(active reserved units) == request.units_needed, total
 * inventory decrement == units_needed, no negative inventory, request COVERED.
 * Exit 0 on success, non-zero on any invariant failure.
 */

require('../backend/tests/helpers/env');

const crypto = require('node:crypto');
const { startTestServer, loginAs, ORIGIN } = require('../backend/tests/helpers/server');
const { createHospital, createBank, requestPayload } = require('../backend/tests/helpers/orgs');
const { getDb, closeDatabase } = require('../backend/src/core/database');

const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
};

async function runScenario(srv, { unitsNeeded, bankCount, perBankStock }) {
  const password = crypto.randomBytes(18).toString('base64url');
  const tag = crypto.randomUUID();
  const banks = [];
  for (let i = 0; i < bankCount; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const org = await createBank({ email: `race-bank-${i}-${tag}@example.test`, password });
    getDb().prepare("UPDATE inventory SET units_available=? WHERE bank_id=? AND blood_group='O-'").run(perBankStock, org.bank.id);
    const client = srv.client();
    // eslint-disable-next-line no-await-in-loop
    const token = await loginAs(client, org.user);
    banks.push({ ...org, client, token });
  }
  const hospital = await createHospital({ email: `race-hospital-${tag}@example.test`, password });
  const hc = srv.client();
  const ht = await loginAs(hc, hospital.user);
  const created = await hc.post('/api/requests', requestPayload({ unitsNeeded }), write(ht));
  const requestId = created.json.data.request.id;

  const results = await Promise.all(
    banks.map((b) => b.client.post(`/api/requests/${requestId}/allocate`, {}, write(b.token))),
  );

  const db = getDb();
  const bankIds = banks.map((b) => b.bank.id);
  const placeholders = bankIds.map(() => '?').join(',');
  const allocated = db.prepare(
    `SELECT COALESCE(SUM(units_reserved),0) n FROM request_allocations WHERE request_id=? AND status IN ('RESERVED','COMPLETED')`,
  ).get(requestId).n;
  const startStock = perBankStock * bankCount;
  const stock = db.prepare(`SELECT COALESCE(SUM(units_available),0) n FROM inventory WHERE bank_id IN (${placeholders}) AND blood_group='O-'`).get(...bankIds).n;
  const negative = db.prepare(`SELECT COUNT(*) n FROM inventory WHERE bank_id IN (${placeholders}) AND units_available < 0`).get(...bankIds).n;
  const status = db.prepare('SELECT status FROM requests WHERE id=?').get(requestId).status;
  const okCount = results.filter((r) => r.status === 201).length;
  const decrement = startStock - stock;

  const pass = allocated === unitsNeeded && decrement === unitsNeeded && negative === 0 && status === 'COVERED';
  console.log(
    `  [${unitsNeeded}-unit / ${bankCount} banks] ok=${okCount} allocated=${allocated} decrement=${decrement} negativeRows=${negative} status=${status} -> ${pass ? 'PASS' : 'FAIL'}`,
  );
  if (!pass) throw new Error(`allocation invariant failed (needed ${unitsNeeded}, allocated ${allocated}, decrement ${decrement})`);
}

async function main() {
  const rounds = arg('--rounds', 1);
  const srv = await startTestServer();
  try {
    for (let round = 1; round <= rounds; round += 1) {
      console.log(`Round ${round}/${rounds}`);
      // Scenario 1 — needs 1 unit, 5 banks each with 2 units.
      await runScenario(srv, { unitsNeeded: 1, bankCount: 5, perBankStock: 2 });
      // Scenario 2 — needs 3 units, 5 banks each with 2 units (multi-bank coverage).
      await runScenario(srv, { unitsNeeded: 3, bankCount: 5, perBankStock: 2 });
    }
    console.log(`\nPASS: ${rounds} round(s), no over-allocation, no negative inventory.`);
  } finally {
    await srv.close();
    closeDatabase();
  }
}

main().catch((err) => { console.error('FAIL:', err.message); process.exitCode = 1; });
