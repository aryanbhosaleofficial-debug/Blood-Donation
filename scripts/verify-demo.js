#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-demo.js  —  non-destructive demo readiness check.
 *
 *   npm run demo:verify
 *
 * Verifies the configured database is reachable, the required pragmas are set,
 * the deterministic demo accounts exist and are verified, banks have seeded
 * inventory, donors are seeded, and the synthetic surge baseline exists.
 * Exit code 0 = READY, non-zero = NOT READY. Never prints passwords/secrets.
 *
 * (The live health endpoint is checked separately by `npm run demo:check`.)
 */

const config = require('../backend/src/core/config');
const { getDb, closeDatabase } = require('../backend/src/core/database');
const { DEMO_ACCOUNTS, BANK_EMAILS, DONOR_EMAILS } = require('./lib/demo-accounts');

const checks = [];
const record = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });

function run() {
  const db = getDb();
  const schema = db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get();

  record('Database reachable', db.prepare('SELECT 1 AS ok').get().ok === 1, config.databasePath);
  record('Foreign keys ON', db.pragma('foreign_keys', { simple: true }) === 1);
  record('WAL journal mode', String(db.pragma('journal_mode', { simple: true })).toLowerCase() === 'wal');
  record('busy_timeout set', Number(db.pragma('busy_timeout', { simple: true })) > 0);
  record('Schema version', schema && schema.value === '9', `schema_version=${schema ? schema.value : 'none'}`);

  for (const role of ['ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR']) {
    const wanted = DEMO_ACCOUNTS.filter((a) => a.role === role);
    const found = wanted.filter((a) => db.prepare('SELECT 1 FROM users WHERE email = ? AND role = ? AND is_active = 1').get(a.email, role));
    record(`${role} account(s)`, found.length === wanted.length, `${found.length}/${wanted.length}`);
  }

  const hospital = db.prepare("SELECT is_verified FROM users WHERE email = 'hospital.demo@example.test'").get();
  record('Hospital verified', hospital && hospital.is_verified === 1);

  const bankVerified = db.prepare(`
    SELECT COUNT(*) AS n FROM users u JOIN blood_banks b ON b.user_id = u.id
    WHERE u.role='BLOOD_BANK' AND u.is_verified = 1 AND b.verified_at IS NOT NULL`).get().n;
  record('Blood banks verified', bankVerified >= BANK_EMAILS.length, `${bankVerified} verified`);

  const invRows = db.prepare(`
    SELECT COUNT(*) AS n FROM inventory i
    JOIN blood_banks b ON b.id = i.bank_id
    JOIN users u ON u.id = b.user_id
    WHERE u.email LIKE 'bank%.demo@example.test' AND i.units_available > 0`).get().n;
  record('Demo inventory seeded', invRows >= 3, `${invRows} stocked rows`);

  const donorRows = db.prepare("SELECT COUNT(*) AS n FROM donors d JOIN users u ON u.id = d.user_id WHERE u.email LIKE 'donor%.demo@example.test'").get().n;
  record('Donor profiles seeded', donorRows >= DONOR_EMAILS.length, `${donorRows} profiles`);

  const syntheticBaseline = db.prepare('SELECT COUNT(*) AS n FROM demand_baselines WHERE is_synthetic = 1').get().n;
  record('Synthetic surge baseline', syntheticBaseline > 0, `${syntheticBaseline} rows`);
}

let ok = false;
try {
  run();
  const width = Math.max(...checks.map((c) => c.name.length));
  process.stdout.write('\nDEMO READINESS CHECK\n\n');
  for (const c of checks) {
    process.stdout.write(`  ${c.name.padEnd(width)} : ${c.pass ? 'PASS' : 'FAIL'}${c.detail ? `  (${c.detail})` : ''}\n`);
  }
  ok = checks.every((c) => c.pass);
  process.stdout.write(`\nSTATUS: ${ok ? 'READY' : 'NOT READY'}\n\n`);
} catch (err) {
  process.stderr.write(`[verify-demo] FAILED: ${err.message}\n`);
  ok = false;
} finally {
  closeDatabase();
}
process.exit(ok ? 0 : 1);
