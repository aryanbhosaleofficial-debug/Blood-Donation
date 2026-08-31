#!/usr/bin/env node
'use strict';

/**
 * scripts/seed-demo.js
 *
 * Creates / refreshes the deterministic local demo environment (idempotent —
 * safe to run repeatedly). Uses `config.demoPassword` for every demo account.
 *
 *   npm run demo:seed                   # seed / refresh demo accounts + inventory
 *   node scripts/seed-demo.js --surge   # also inject the fresh surge spike
 *
 * DEMO ONLY. Not for production data.
 */

const config = require('../backend/src/core/config');
const { getDb, closeDatabase } = require('../backend/src/core/database');
const { seedDemo, injectSurgeScenario, DEMO_ACCOUNTS } = require('./lib/demo-data');

let failed = false;
try {
  const withSurge = process.argv.includes('--surge');
  const db = getDb();

  const summary = seedDemo(db);
  const surgeInjected = withSurge ? injectSurgeScenario(db) : 0;

  const out = process.stdout;
  out.write('DEMO SEED COMPLETE\n');
  out.write(`  database        : ${config.databasePath}\n`);
  out.write(`  admin           : ${summary.admin}\n`);
  out.write(`  hospital        : ${summary.hospital}\n`);
  out.write(`  blood banks     : ${summary.banks}\n`);
  out.write(`  donors          : ${summary.donors}\n`);
  out.write(`  surge hospitals : ${summary.surgeHospitals}\n`);
  if (withSurge) out.write(`  surge spike     : ${surgeInjected} synthetic O- requests injected (created_at = now)\n`);
  out.write('\nDemo accounts (password: $DEMO_PASSWORD — see .env / .env.example):\n');
  for (const acc of DEMO_ACCOUNTS) out.write(`  ${acc.role.padEnd(11)} ${acc.email}\n`);
} catch (err) {
  process.stderr.write(`[seed-demo] FAILED: ${err.message}\n`);
  failed = true;
} finally {
  closeDatabase();
}
process.exit(failed ? 1 : 0);
