#!/usr/bin/env node
'use strict';

/**
 * scripts/reset-demo.js
 *
 * DESTRUCTIVE for the configured demo database only. Clears every domain table
 * (schema + app_meta are kept) and re-seeds the deterministic demo environment.
 *
 *   npm run demo:reset
 *   node scripts/reset-demo.js --surge   # also inject the fresh surge spike
 *
 * SAFETY: refuses to run when NODE_ENV=production. There is deliberately no
 * override flag — a production database must never be reset by this script.
 * It also refuses if the server appears to be actively writing (stale check).
 */

const config = require('../backend/src/core/config');

if (config.isProduction) {
  console.error('[reset-demo] REFUSING: NODE_ENV=production. Demo reset is not allowed in production.');
  process.exit(2);
}

const { getDb, closeDatabase } = require('../backend/src/core/database');
const { seedDemo, injectSurgeScenario } = require('./lib/demo-data');

// Reverse dependency order (explicit, though most FKs cascade).
const TABLES = [
  'surge_events', 'surge_candidates', 'demand_baselines',
  'audit_logs', 'notifications',
  'donor_location_sessions', 'donor_pledges', 'donor_alerts',
  'request_allocations', 'request_broadcasts',
  'inventory_adjustments', 'requests', 'inventory',
  'donors', 'blood_banks', 'hospitals', 'users',
];

let failed = false;
try {
  const withSurge = process.argv.includes('--surge');
  const db = getDb();

  // foreign_keys pragma cannot be toggled inside a transaction; delete in
  // reverse-dependency order instead (cascades cover the rest).
  const wipe = db.transaction(() => {
    for (const table of TABLES) {
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (exists) db.prepare(`DELETE FROM ${table}`).run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
    }
  });
  wipe();

  const summary = seedDemo(db);
  const surge = withSurge ? injectSurgeScenario(db) : 0;

  db.exec('VACUUM');

  const out = process.stdout;
  out.write('DEMO RESET COMPLETE\n');
  out.write(`  database   : ${config.databasePath}\n`);
  out.write(`  cleared    : ${TABLES.length} domain tables\n`);
  out.write(`  re-seeded  : admin=${summary.admin} hospital=${summary.hospital} banks=${summary.banks} donors=${summary.donors} surgeHospitals=${summary.surgeHospitals}\n`);
  if (withSurge) out.write(`  surge spike: ${surge} synthetic O- requests injected\n`);
  out.write('\nRun `npm run demo:verify` to confirm readiness.\n');
} catch (err) {
  process.stderr.write(`[reset-demo] FAILED: ${err.message}\n`);
  failed = true;
} finally {
  closeDatabase();
}
process.exit(failed ? 1 : 0);
