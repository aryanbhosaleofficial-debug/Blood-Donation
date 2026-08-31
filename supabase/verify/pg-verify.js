'use strict';

/**
 * supabase/verify/pg-verify.js
 *
 * Real-PostgreSQL verification of the transactional migration
 * (supabase/migrations/0001..0003). Boots an ephemeral PostgreSQL 18 cluster
 * via `embedded-postgres`, applies the migrations verbatim, and exercises the
 * race-critical RPCs with genuinely concurrent connections.
 *
 * This is NOT a mock. Every assertion below runs against a live server with
 * real MVCC, real row locks (FOR UPDATE / FOR UPDATE SKIP LOCKED) and real
 * transaction isolation — the guarantees that replace SQLite BEGIN IMMEDIATE.
 *
 *   node supabase/verify/pg-verify.js
 *
 * Exit 0 = all checks passed. Exit 1 = a check failed. Nothing here touches
 * the app's SQLite database or requires a Supabase project.
 */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');

const MIGRATIONS = ['0001_schema.sql', '0002_functions.sql', '0003_grants.sql'].map((f) =>
  path.join(__dirname, '..', 'migrations', f),
);
const INVENTORY_MAX = 10000;
const PORT = 55432 + (process.pid % 1000);

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function domainCode(err) {
  // RAISE EXCEPTION ... MESSAGE = '<CODE>' surfaces as err.message on node-postgres.
  return err && typeof err.message === 'string' ? err.message.trim() : String(err);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-pgverify-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
  });

  console.log(`\nBooting ephemeral PostgreSQL on port ${PORT} (${dataDir}) ...`);
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');

  const { Client } = require('pg');
  const connString = `postgresql://postgres:postgres@127.0.0.1:${PORT}/app`;
  const admin = new Client({ connectionString: connString });
  await admin.connect();

  try {
    const serverVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
    console.log(`Connected to PostgreSQL ${serverVersion}\n`);

    // --- Apply migrations verbatim ---------------------------------------
    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(file, 'utf8');
      await admin.query(sql);
      console.log(`  applied ${path.basename(file)}`);
    }
    console.log('');

    // --- Fixtures -------------------------------------------------------
    // Minimal graph: 1 hospital, 5 verified banks (stock 1 each), 5 donors.
    await admin.query(`
      INSERT INTO users (email, password_hash, role, is_verified, is_active) VALUES
        ('hospital@verify.test', 'x', 'HOSPITAL', true, true),
        ('admin@verify.test',    'x', 'ADMIN',    true, true);
    `);
    for (let i = 1; i <= 5; i += 1) {
      await admin.query(
        `INSERT INTO users (email, password_hash, role, is_verified, is_active)
         VALUES ($1, 'x', 'BLOOD_BANK', true, true)`,
        [`bank${i}@verify.test`],
      );
      await admin.query(
        `INSERT INTO users (email, password_hash, role, is_verified, is_active)
         VALUES ($1, 'x', 'DONOR', true, true)`,
        [`donor${i}@verify.test`],
      );
    }
    const hospUserId = (await admin.query(`SELECT id FROM users WHERE email='hospital@verify.test'`)).rows[0].id;
    await admin.query(
      `INSERT INTO hospitals (user_id, name, registration_reference, contact_name, contact_phone, address, city, verified_at)
       VALUES ($1, 'Verify General', 'REG-V1', 'C', '0', 'A', 'Testville', now())`,
      [hospUserId],
    );
    const hospitalId = (await admin.query(`SELECT id FROM hospitals WHERE user_id=$1`, [hospUserId])).rows[0].id;

    const bankUserIds = (await admin.query(
      `SELECT id FROM users WHERE role='BLOOD_BANK' ORDER BY id`,
    )).rows.map((r) => r.id);
    const bankIds = [];
    for (let i = 0; i < bankUserIds.length; i += 1) {
      await admin.query(
        `INSERT INTO blood_banks (user_id, name, license_no, contact_name, contact_phone, address, city, verified_at)
         VALUES ($1, $2, $3, 'C', '0', 'A', 'Testville', now())`,
        [bankUserIds[i], `Bank ${i + 1}`, `LIC-${i + 1}`],
      );
      const bankId = (await admin.query(`SELECT id FROM blood_banks WHERE user_id=$1`, [bankUserIds[i]])).rows[0].id;
      bankIds.push(bankId);
      await admin.query(
        `INSERT INTO inventory (bank_id, blood_group, component, units_available) VALUES ($1, 'O-', 'RED_CELLS', 1)`,
        [bankId],
      );
    }

    const donorUserIds = (await admin.query(
      `SELECT id FROM users WHERE role='DONOR' ORDER BY id`,
    )).rows.map((r) => r.id);
    const donorIds = [];
    for (let i = 0; i < donorUserIds.length; i += 1) {
      await admin.query(
        `INSERT INTO donors (user_id, display_name, blood_group, city) VALUES ($1, $2, 'O-', 'Testville')`,
        [donorUserIds[i], `Donor ${i + 1}`],
      );
      donorIds.push((await admin.query(`SELECT id FROM donors WHERE user_id=$1`, [donorUserIds[i]])).rows[0].id);
    }

    // Helper: make a fresh OPEN request broadcast to all banks.
    async function makeRequest(unitsNeeded, backupSlots = 0, expiresInMs = 3600_000) {
      const crid = crypto.randomUUID();
      const res = await admin.query(
        `SELECT bd_create_request_with_broadcasts($1,$2,'O-','RED_CELLS',$3,$4,'CRITICAL',NULL, now() + ($5 || ' milliseconds')::interval) AS r`,
        [hospUserId, crid, unitsNeeded, backupSlots, String(expiresInMs)],
      );
      return res.rows[0].r.request.id;
    }

    async function newClient() {
      const c = new Client({ connectionString: connString });
      await c.connect();
      return c;
    }

    // =====================================================================
    // TEST 1 — allocation race, 1 unit needed, 5 banks fire simultaneously
    // =====================================================================
    {
      const reqId = await makeRequest(1);
      const clients = await Promise.all(bankUserIds.map(newClient));
      const results = await Promise.allSettled(
        clients.map((c, i) =>
          c.query('SELECT bd_reserve_allocation($1,$2,$3) AS r', [bankUserIds[i], reqId, INVENTORY_MAX]),
        ),
      );
      await Promise.all(clients.map((c) => c.end()));

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const codes = results.filter((r) => r.status === 'rejected').map((r) => domainCode(r.reason)).sort();
      const sumReserved = Number(
        (await admin.query(
          `SELECT COALESCE(SUM(units_reserved),0) n FROM request_allocations WHERE request_id=$1 AND status IN ('RESERVED','COMPLETED')`,
          [reqId],
        )).rows[0].n,
      );
      const minInv = Number((await admin.query(`SELECT MIN(units_available) n FROM inventory`)).rows[0].n);
      const status = (await admin.query(`SELECT status FROM requests WHERE id=$1`, [reqId])).rows[0].status;

      check('race(1u): exactly one reservation succeeded', ok === 1, `ok=${ok}`);
      check('race(1u): SUM(reserved) == 1', sumReserved === 1, `sum=${sumReserved}`);
      check('race(1u): no negative inventory', minInv >= 0, `min=${minInv}`);
      check('race(1u): request COVERED', status === 'COVERED', `status=${status}`);
      check('race(1u): losers got domain errors', codes.every((c) => /ALREADY_COVERED|NO_STOCK|REQUEST_NOT_OPEN/.test(c)), codes.join(','));
    }

    // =====================================================================
    // TEST 2 — allocation race, 3 units needed, 5 banks (1 unit each)
    // =====================================================================
    {
      // top inventories back to 1
      await admin.query(`UPDATE inventory SET units_available = 1, version = version + 1`);
      const reqId = await makeRequest(3);
      const clients = await Promise.all(bankUserIds.map(newClient));
      const results = await Promise.allSettled(
        clients.map((c, i) =>
          c.query('SELECT bd_reserve_allocation($1,$2,$3) AS r', [bankUserIds[i], reqId, INVENTORY_MAX]),
        ),
      );
      await Promise.all(clients.map((c) => c.end()));

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const sumReserved = Number(
        (await admin.query(
          `SELECT COALESCE(SUM(units_reserved),0) n FROM request_allocations WHERE request_id=$1 AND status IN ('RESERVED','COMPLETED')`,
          [reqId],
        )).rows[0].n,
      );
      const minInv = Number((await admin.query(`SELECT MIN(units_available) n FROM inventory`)).rows[0].n);
      const status = (await admin.query(`SELECT status FROM requests WHERE id=$1`, [reqId])).rows[0].status;

      check('race(3u): exactly three reservations succeeded', ok === 3, `ok=${ok}`);
      check('race(3u): SUM(reserved) == 3', sumReserved === 3, `sum=${sumReserved}`);
      check('race(3u): no negative inventory', minInv >= 0, `min=${minInv}`);
      check('race(3u): request COVERED', status === 'COVERED', `status=${status}`);
    }

    // =====================================================================
    // TEST 3 — inventory version conflict (optimistic concurrency)
    // =====================================================================
    {
      await admin.query(`UPDATE inventory SET units_available = 5, version = 0`);
      const invRow = (await admin.query(`SELECT id, bank_id FROM inventory ORDER BY id LIMIT 1`)).rows[0];
      const ownerUserId = (await admin.query(`SELECT user_id FROM blood_banks WHERE id=$1`, [invRow.bank_id])).rows[0].user_id;
      const c1 = await newClient();
      const c2 = await newClient();
      const results = await Promise.allSettled([
        c1.query('SELECT bd_update_inventory_versioned($1,$2,0,7,$3) AS r', [ownerUserId, invRow.id, 'v-test-a']),
        c2.query('SELECT bd_update_inventory_versioned($1,$2,0,2,$3) AS r', [ownerUserId, invRow.id, 'v-test-b']),
      ]);
      await c1.end();
      await c2.end();
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const codes = results.filter((r) => r.status === 'rejected').map((r) => domainCode(r.reason));
      check('inv-version: exactly one update succeeded', ok === 1, `ok=${ok}`);
      check('inv-version: the loser got INVENTORY_VERSION_CONFLICT', codes.length === 1 && codes[0] === 'INVENTORY_VERSION_CONFLICT', codes.join(','));
    }

    // =====================================================================
    // TEST 4 — pledge race: capacity = units_needed(1) + backup_slots(1) = 2
    // =====================================================================
    {
      const reqId = await makeRequest(1, 1);
      const alertIds = [];
      for (const donorId of donorIds) {
        const a = (await admin.query(
          `INSERT INTO donor_alerts (request_id, donor_id, status) VALUES ($1,$2,'ACTIVE') RETURNING id`,
          [reqId, donorId],
        )).rows[0].id;
        alertIds.push(a);
      }
      const clients = await Promise.all(donorUserIds.map(newClient));
      const results = await Promise.allSettled(
        clients.map((c, i) =>
          c.query('SELECT bd_create_donor_pledge($1,$2,$3,now()) AS r', [
            donorUserIds[i],
            alertIds[i],
            `PDG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          ]),
        ),
      );
      await Promise.all(clients.map((c) => c.end()));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const codes = results.filter((r) => r.status === 'rejected').map((r) => domainCode(r.reason));
      const active = Number(
        (await admin.query(
          `SELECT COUNT(*) n FROM donor_pledges WHERE request_id=$1 AND status IN ('PLEDGED','ARRIVED')`,
          [reqId],
        )).rows[0].n,
      );
      check('pledge-race: exactly 2 pledges accepted', ok === 2, `ok=${ok}`);
      check('pledge-race: active pledges == 2 (<= capacity)', active === 2, `active=${active}`);
      check('pledge-race: the other 3 got SLOTS_FULL', codes.filter((c) => c === 'SLOTS_FULL').length === 3, codes.join(','));
    }

    // =====================================================================
    // TEST 5 — request expiry idempotency + restore-inventory-exactly-once
    // =====================================================================
    {
      await admin.query(`UPDATE inventory SET units_available = 5, version = 0`);
      const reqId = await makeRequest(2, 0, -1000); // already expired
      // reserve from bank 1 while still "open" for the test: force-open, reserve, then it is past expiry
      await admin.query(`UPDATE requests SET expires_at = now() + interval '1 hour' WHERE id=$1`, [reqId]);
      await admin.query('SELECT bd_reserve_allocation($1,$2,$3)', [bankUserIds[0], reqId, INVENTORY_MAX]);
      const invAfterReserve = Number(
        (await admin.query(`SELECT units_available FROM inventory WHERE bank_id=$1`, [bankIds[0]])).rows[0].units_available,
      );
      const reservedUnits = Number(
        (await admin.query(
          `SELECT units_reserved FROM request_allocations WHERE request_id=$1 AND bank_id=$2`,
          [reqId, bankIds[0]],
        )).rows[0].units_reserved,
      );
      await admin.query(`UPDATE requests SET expires_at = now() - interval '1 second' WHERE id=$1`, [reqId]);

      const first = (await admin.query('SELECT bd_expire_request($1, now(), $2) AS r', [reqId, INVENTORY_MAX])).rows[0].r;
      const invAfter1 = Number(
        (await admin.query(`SELECT units_available FROM inventory WHERE bank_id=$1`, [bankIds[0]])).rows[0].units_available,
      );
      const second = (await admin.query('SELECT bd_expire_request($1, now(), $2) AS r', [reqId, INVENTORY_MAX])).rows[0].r;
      const invAfter2 = Number(
        (await admin.query(`SELECT units_available FROM inventory WHERE bank_id=$1`, [bankIds[0]])).rows[0].units_available,
      );
      const status = (await admin.query(`SELECT status FROM requests WHERE id=$1`, [reqId])).rows[0].status;
      const restoreAdjustments = Number(
        (await admin.query(
          `SELECT COUNT(*) n FROM inventory_adjustments WHERE reason = $1`,
          [`REQUEST_EXPIRY_RESTORE:req=${reqId}`],
        )).rows[0].n,
      );

      check('expiry: first run reports 1 released allocation', first && first.releasedAllocationCount === 1, JSON.stringify(first));
      check('expiry: inventory restored exactly once', invAfter1 === invAfterReserve + reservedUnits && invAfter2 === invAfter1, `reserve=${invAfterReserve} restored=${reservedUnits} a1=${invAfter1} a2=${invAfter2}`);
      check('expiry: second run is a no-op (null)', second === null, JSON.stringify(second));
      check('expiry: exactly one restore adjustment row', restoreAdjustments === 1, `rows=${restoreAdjustments}`);
      check('expiry: request status EXPIRED', status === 'EXPIRED', `status=${status}`);
    }

    // =====================================================================
    // TEST 6 — FOR UPDATE SKIP LOCKED: concurrent queue claims never overlap
    // =====================================================================
    {
      await admin.query(`DELETE FROM notifications`);
      for (let i = 0; i < 20; i += 1) {
        await admin.query(
          `SELECT bd_enqueue_notification($1,'TEST','REQUEST',$2,$3,'t','m','{}'::jsonb)`,
          [donorUserIds[0], i, `skiplocked-${i}`],
        );
      }
      const c1 = await newClient();
      const c2 = await newClient();
      const [r1, r2] = await Promise.all([
        c1.query('SELECT id FROM bd_claim_due_notifications(10, 60)'),
        c2.query('SELECT id FROM bd_claim_due_notifications(10, 60)'),
      ]);
      await c1.end();
      await c2.end();
      const s1 = new Set(r1.rows.map((x) => Number(x.id)));
      const s2 = new Set(r2.rows.map((x) => Number(x.id)));
      const overlap = [...s1].filter((x) => s2.has(x));
      const total = s1.size + s2.size;
      check('skip-locked: two workers claimed disjoint rows', overlap.length === 0, `overlap=${overlap.length}`);
      check('skip-locked: claimed rows total 20', total === 20, `total=${total}`);
      const stillDue = Number(
        (await admin.query(
          `SELECT COUNT(*) n FROM notifications WHERE status='QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= now())`,
        )).rows[0].n,
      );
      check('skip-locked: leased rows no longer due', stillDue === 0, `stillDue=${stillDue}`);
    }

    // =====================================================================
    // TEST 7 — notification insert participates in the caller transaction
    // =====================================================================
    {
      await admin.query(`DELETE FROM notifications`);
      const c1 = await newClient();
      let threw = false;
      try {
        await c1.query('BEGIN');
        await c1.query(
          `SELECT bd_enqueue_notification($1,'ROLLBACK_TEST','REQUEST',1,'rollback-1','t','m','{}'::jsonb)`,
          [donorUserIds[0]],
        );
        await c1.query('SELECT 1 / 0'); // force error inside the same transaction
      } catch {
        threw = true;
        await c1.query('ROLLBACK');
      }
      await c1.end();
      const n = Number((await admin.query(`SELECT COUNT(*) n FROM notifications WHERE dedupe_key='rollback-1'`)).rows[0].n);
      check('notif-txn: enqueue rolled back with the failing transaction', threw && n === 0, `threw=${threw} rows=${n}`);
    }

    // =====================================================================
    // TEST 8 — RLS is enabled and denies anon/authenticated
    // =====================================================================
    {
      const rlsCount = Number(
        (await admin.query(
          `SELECT COUNT(*) n FROM pg_tables t
             JOIN pg_class c ON c.relname = t.tablename
            WHERE t.schemaname='public' AND c.relrowsecurity = true`,
        )).rows[0].n,
      );
      const tableCount = Number(
        (await admin.query(`SELECT COUNT(*) n FROM pg_tables WHERE schemaname='public'`)).rows[0].n,
      );
      const anonPolicies = Number(
        (await admin.query(
          `SELECT COUNT(*) n FROM pg_policies WHERE schemaname='public' AND 'anon' = ANY(roles)`,
        )).rows[0].n,
      );
      check('rls: every public table has RLS enabled', rlsCount === tableCount, `${rlsCount}/${tableCount}`);
      check('rls: zero permissive anon policies', anonPolicies === 0, `policies=${anonPolicies}`);
    }

    // =====================================================================
    // TEST 9 — surge candidate confirm is a one-shot state transition
    // =====================================================================
    {
      const adminUserId = (await admin.query(`SELECT id FROM users WHERE email='admin@verify.test'`)).rows[0].id;
      await admin.query(`
        INSERT INTO surge_candidates
          (city, blood_group, window_started_at, window_ended_at, observed_request_count,
           expected_lambda, poisson_tail_probability, dedupe_key)
        VALUES ('Testville','O-', now() - interval '1 hour', now(), 9, 2.0, 0.001, 'surge-verify-1')
      `);
      const candId = (await admin.query(`SELECT id FROM surge_candidates WHERE dedupe_key='surge-verify-1'`)).rows[0].id;
      const c1 = await newClient();
      const c2 = await newClient();
      const results = await Promise.allSettled([
        c1.query('SELECT bd_confirm_surge_candidate($1,$2,$3)', [adminUserId, candId, 'a']),
        c2.query('SELECT bd_confirm_surge_candidate($1,$2,$3)', [adminUserId, candId, 'b']),
      ]);
      await c1.end();
      await c2.end();
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const codes = results.filter((r) => r.status === 'rejected').map((r) => domainCode(r.reason));
      const events = Number((await admin.query(`SELECT COUNT(*) n FROM surge_events WHERE candidate_id=$1`, [candId])).rows[0].n);
      check('surge: exactly one confirm succeeded', ok === 1, `ok=${ok}`);
      check('surge: loser got INVALID_SURGE_STATE', codes.length === 1 && codes[0] === 'INVALID_SURGE_STATE', codes.join(','));
      check('surge: exactly one surge_event created', events === 1, `events=${events}`);
    }

    // =====================================================================
    // TEST 10 — PgSessionStore round trip (get/set/touch/destroy/length)
    // =====================================================================
    {
      const { Pool } = require('pg');
      const { PgSessionStore } = require('../../backend/src/security/pg-session-store');
      const pool = new Pool({ connectionString: connString });
      const store = new PgSessionStore({ pool, pruneIntervalMs: 0 });
      const call = (fn, ...args) =>
        new Promise((resolve, reject) => fn.call(store, ...args, (e, v) => (e ? reject(e) : resolve(v))));

      const sess = { cookie: { maxAge: 3600_000 }, user: { id: 7, role: 'ADMIN' } };
      await call(store.set, 'sid-verify-1', sess);
      const got = await call(store.get, 'sid-verify-1');
      check('session: set then get returns the same session', got && got.user && got.user.id === 7, JSON.stringify(got));

      await call(store.touch, 'sid-verify-1', sess);
      const len1 = await call(store.length);
      check('session: length counts the live session', len1 === 1, `len=${len1}`);

      // expired session is not returned and is swept
      await pool.query(`INSERT INTO sessions (sid, sess, expires_at) VALUES ('sid-expired', '{}'::jsonb, now() - interval '1 minute')`);
      const expired = await call(store.get, 'sid-expired');
      check('session: expired session reads as null', expired === null, JSON.stringify(expired));

      await call(store.destroy, 'sid-verify-1');
      const gone = await call(store.get, 'sid-verify-1');
      check('session: destroy removes the row', gone === null, JSON.stringify(gone));

      store.stopPruneTimer();
      await pool.end();
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`PostgreSQL verification: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
  } finally {
    await admin.end();
    await pg.stop();
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* Windows may hold a handle briefly; ephemeral temp dir, safe to leak */
    }
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nHARNESS ERROR:', err);
  process.exit(1);
});
