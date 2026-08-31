'use strict';

/**
 * scripts/migrate-sqlite-to-supabase.js
 *
 * One-time data copy from the local SQLite database into a Supabase
 * PostgreSQL project whose schema was already created by
 * supabase/migrations/0001..0003.
 *
 * SAFETY GUARDS (all must pass or the script aborts before touching anything):
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.
 *   - SUPABASE_DB_URL (direct Postgres connection) must be set — the copy uses
 *     `pg` for speed and sequence resync, not PostgREST.
 *   - `--confirm` flag must be passed for a real run. Without it the script
 *     does a DRY RUN: it reads SQLite, prints row counts, and exits.
 *   - Refuses when SUPABASE_PROJECT_ENV=production unless `--allow-production`.
 *
 * NEVER copied: the `sessions` table and any secret. Sessions are intentionally
 * dropped so every user is forced to re-authenticate after the cutover.
 *
 * Tables are copied in foreign-key order. Identity sequences are resynced to
 * MAX(id)+1 afterwards so new inserts do not collide with copied rows.
 */

const path = require('node:path');
const process = require('node:process');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has('--confirm');
const ALLOW_PROD = args.has('--allow-production');

// FK-safe insertion order. `sessions` is deliberately absent.
const TABLE_ORDER = [
  'app_meta',
  'users',
  'hospitals',
  'blood_banks',
  'inventory',
  'inventory_adjustments',
  'requests',
  'request_broadcasts',
  'request_allocations',
  'donors',
  'donor_alerts',
  'donor_pledges',
  'donor_location_sessions',
  'notifications',
  'audit_logs',
  'demand_baselines',
  'surge_candidates',
  'surge_events',
];

const BOOLEAN_COLUMNS = new Set([
  'is_verified', 'is_active', 'is_synthetic',
]);
const JSON_COLUMNS = new Set(['payload_json', 'metadata_json']);

function fail(msg) {
  console.error(`\n  ABORT: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;
  const projectEnv = process.env.SUPABASE_PROJECT_ENV || 'development';

  if (!url || !key) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.');
  if (!dbUrl) fail('SUPABASE_DB_URL (direct Postgres connection string) must be set.');
  if (projectEnv === 'production' && !ALLOW_PROD) {
    fail('SUPABASE_PROJECT_ENV=production. Re-run with --allow-production if you really mean it.');
  }

  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3');
  // eslint-disable-next-line global-require
  const { Client } = require('pg');

  const sqlitePath = process.env.DATABASE_PATH
    ? path.resolve(ROOT, process.env.DATABASE_PATH)
    : path.join(ROOT, 'data', 'app.db');
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  console.log(`\n  Source  : ${sqlitePath}`);
  console.log(`  Target  : ${url}  (env=${projectEnv})`);
  console.log(`  Mode    : ${CONFIRM ? 'LIVE COPY' : 'DRY RUN (pass --confirm to write)'}\n`);

  const plan = [];
  for (const table of TABLE_ORDER) {
    let rows = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      console.log(`  - ${table.padEnd(26)} (not present in source, skipped)`);
      continue;
    }
    plan.push({ table, rows });
    console.log(`  - ${table.padEnd(26)} ${rows.length} row(s)`);
  }

  if (!CONFIRM) {
    console.log('\n  Dry run complete. No data was written.\n');
    sqlite.close();
    return;
  }

  const pg = new Client({ connectionString: dbUrl });
  await pg.connect();
  try {
    await pg.query('BEGIN');
    await pg.query('SET session_replication_role = replica'); // defer FK checks during bulk load

    for (const { table, rows } of plan) {
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const colList = columns.map((c) => `"${c}"`).join(', ');
      for (const row of rows) {
        const values = columns.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return null;
          if (BOOLEAN_COLUMNS.has(c)) return v === 1 || v === true;
          if (JSON_COLUMNS.has(c)) return typeof v === 'string' ? v : JSON.stringify(v);
          return v;
        });
        const params = values.map((_, i) => `$${i + 1}`).join(', ');
        // OVERRIDING SYSTEM VALUE lets us keep the original numeric ids.
        await pg.query(
          `INSERT INTO ${table} (${colList}) OVERRIDING SYSTEM VALUE VALUES (${params})
           ON CONFLICT DO NOTHING`,
          values,
        );
      }
      console.log(`  copied ${table} (${rows.length})`);
    }

    // Resync identity sequences to MAX(id)+1.
    for (const { table } of plan) {
      const hasId = (await pg.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'id'`,
        [table],
      )).rowCount > 0;
      if (!hasId) continue;
      await pg.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'),
                       GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`,
        [table],
      );
    }

    await pg.query('SET session_replication_role = DEFAULT');
    await pg.query('COMMIT');
    console.log('\n  Copy committed. Sessions were NOT migrated — all users must re-authenticate.\n');
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {});
    fail(`copy failed and was rolled back: ${err.message}`);
  } finally {
    await pg.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
