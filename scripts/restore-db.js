#!/usr/bin/env node
'use strict';

/**
 * scripts/restore-db.js  —  restore the database from a backup snapshot.
 *
 *   node scripts/restore-db.js --from data/backups/app-20260101-120000.db --yes
 *
 * SAFETY:
 *   - refuses when NODE_ENV=production
 *   - requires an explicit --from <path> that must exist
 *   - requires an explicit --yes (this overwrites the live database file)
 *   - the server must NOT be running (it would keep writing the old file)
 *
 * For routine demo resets prefer `npm run demo:reset` (deterministic re-seed)
 * over restoring a snapshot.
 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../backend/src/core/config');

function fail(msg, code = 1) {
  console.error(`[restore-db] ${msg}`);
  process.exit(code);
}

if (config.isProduction) fail('REFUSING: NODE_ENV=production.', 2);

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const from = fromIdx !== -1 ? args[fromIdx + 1] : null;
const confirmed = args.includes('--yes');

if (!from) fail('missing --from <backup path>.');
const src = path.resolve(from);
if (!fs.existsSync(src)) fail(`backup not found: ${src}`);
if (!confirmed) fail('add --yes to confirm overwriting ' + config.databasePath + ' (ensure the server is stopped).');

const target = config.databasePath;
// Remove WAL/SHM sidecars of the target so the restored file is authoritative.
for (const ext of ['', '-wal', '-shm', '-journal']) {
  const p = target + ext;
  if (fs.existsSync(p)) fs.rmSync(p);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(src, target);

console.log('DATABASE RESTORE COMPLETE');
console.log(`  from : ${src}`);
console.log(`  to   : ${target}`);
console.log('\nStart the server and run `npm run demo:verify` to check state.');
process.exit(0);
