#!/usr/bin/env node
'use strict';

/**
 * scripts/backup-db.js  —  SQLite-safe backup snapshot.
 *
 *   npm run db:backup
 *
 * Uses `VACUUM INTO`, which produces a single consistent database file even
 * while the source is in WAL mode with pending writes. Do NOT just
 * `cp data/app.db data/app.db.bak` — with WAL the committed state can live in
 * the -wal file and a plain copy may be torn / stale.
 *
 * Output: <BACKUP_DIR>/app-YYYYMMDD-HHMMSS.db  (BACKUP_DIR is git-ignored).
 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../backend/src/core/config');
const { getDb, closeDatabase } = require('../backend/src/core/database');

let failed = false;
try {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\.(\d{3})Z$/, '-$1');
  const dest = path.join(config.backupDir, `app-${ts}.db`);
  if (fs.existsSync(dest)) fs.rmSync(dest);

  const db = getDb();
  // dest is script-generated (timestamped, inside BACKUP_DIR) — not user input.
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  const bytes = fs.statSync(dest).size;

  const out = process.stdout;
  out.write('DATABASE BACKUP COMPLETE\n');
  out.write(`  source : ${config.databasePath}\n`);
  out.write(`  backup : ${dest}\n`);
  out.write(`  size   : ${(bytes / 1024).toFixed(1)} KiB\n`);
  out.write(`\nRestore with:  node scripts/restore-db.js --from "${dest}" --yes\n`);
} catch (err) {
  process.stderr.write(`[backup-db] FAILED: ${err.message}\n`);
  failed = true;
} finally {
  closeDatabase();
}
process.exit(failed ? 1 : 0);
