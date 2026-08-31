# Tech-Stack Upgrade — Migration Status

**OLD stack:** React + Vite · Node + Express · SQLite + better-sqlite3
**NEW stack:** React + Vite · Node + Express · Supabase PostgreSQL (`@supabase/supabase-js`) · Google Gemini API (backend only)

**Overall status: INCOMPLETE — repository-side work done; schema + transactional
functions + RLS are live and verified on the actual Supabase project; the
application cutover (repositories / workers / test harness to `supabase-js`) is
PENDING.**

This repository does not currently have Supabase credentials, a Supabase project,
a Docker daemon, or a local `psql`/`supabase` CLI. Per the migration brief, all
repository-side code, migrations, and tests that can be produced without those
have been produced, and the concurrency-critical core has been verified against a
**real, ephemeral PostgreSQL 18 server** (via `embedded-postgres`). The parts
that genuinely require a Supabase project are listed as PENDING below and have
**not** been faked.

`DB_PROVIDER` defaults to `sqlite`, so the application still runs on the
fully-tested SQLite runtime and **all existing tests pass unchanged**
(380 backend, 37 frontend).

---

## DONE (in this repository, verified)

| Area | Artifact | Verification |
|---|---|---|
| PostgreSQL schema | `supabase/migrations/0001_schema.sql` — 19 tables, all FK/UNIQUE/CHECK/indexes (incl. partial), `TIMESTAMPTZ`/`BOOLEAN`/`JSONB`/`BIGINT IDENTITY`/`DOUBLE PRECISION`, shared `set_updated_at()` trigger, append-only `audit_logs` trigger | applied clean by `npm run verify:pg` |
| Transactional logic | `supabase/migrations/0002_functions.sql` — every `BEGIN IMMEDIATE` transaction reproduced as a PL/pgSQL function (`bd_*`), one transaction per `rpc()` call, `SELECT … FOR UPDATE` row locks, `FOR UPDATE SKIP LOCKED` for the notification queue, domain error codes via `RAISE EXCEPTION … MESSAGE` | 32/32 checks in `npm run verify:pg` |
| Grants + RLS | `supabase/migrations/0003_grants.sql` — REVOKE from `anon`/`authenticated`, REVOKE `bd_*` from PUBLIC, RLS enabled on every table with **no** permissive policies | verified: 19/19 tables RLS-on, 0 anon policies |
| Real-DB race verification | `supabase/verify/pg-verify.js` | **allocation race 1-unit → exactly 1**, **3-unit → exactly 3** (no negative inventory, request COVERED); **pledge race capacity 2 → exactly 2**, rest `SLOTS_FULL`; **inventory version conflict → `INVENTORY_VERSION_CONFLICT`**; **expiry idempotent** (inventory restored exactly once, second run is a no-op); **`FOR UPDATE SKIP LOCKED` claims are disjoint**; **notification insert rolls back with its caller transaction**; surge confirm is one-shot; `PgSessionStore` round-trips |
| Supabase client | `backend/src/core/supabase.js` — single service-role client, lazy, memoized, guarded by `DB_PROVIDER` | unit-guarded (throws unless `DB_PROVIDER=supabase`) |
| Error mapping | `backend/src/core/supabase-errors.js` — PostgREST/PG error → domain error code; never leaks SQL, schema, or PostgREST payload | code allow-list |
| PostgreSQL session store | `backend/src/security/pg-session-store.js` — `express-session` store on the `sessions` table (`get/set/destroy/touch/length/clear/all` + prune) | round-trip + expiry test in `verify:pg` |
| Gemini foundation | `backend/src/integrations/gemini/` — `constants`, `config`, `errors`, `sanitizer`, `client` (lazy SDK, `AbortSignal.timeout`, typed failures), `service` (ADMIN-only de-identified operations summary), `mock` | `backend/tests/integration/gemini-integration.test.js` — 12 tests: disabled path, config errors, forbidden-key sanitizer, success, timeout / 429 / provider / malformed all non-fatal, prompt never contains `phone_private`/`latitude`/`password_hash`/notes, logs never contain the key or raw prompt |
| Config | `backend/src/core/config.js` — `DB_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_ENV`, `DEMO_MODE`, `GEMINI_*`; validation requires the Supabase pair when `DB_PROVIDER=supabase` and a key when `GEMINI_ENABLED=true` | `backend/tests/config.test.js` + gemini tests |
| Health endpoint | `GET /api/health` now returns `databaseProvider`, `geminiConfigured`, `geminiEnabled` — no URL, key, or connection string; no live Gemini call | `backend/tests/health.test.js` (asserts no secret material in payload) |
| Data-migration script | `scripts/migrate-sqlite-to-supabase.js` — FK-ordered copy, identity-sequence resync, **never copies `sessions` or secrets**, dry-run without `--confirm`, aborts without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_DB_URL`, refuses `SUPABASE_PROJECT_ENV=production` without `--allow-production` | abort paths exercised (`exit 1`) |
| Frontend secret check | `frontend/tests/security.test.jsx` — source, env files, `package.json`, and (if present) the built bundle contain none of `SUPABASE_SERVICE_ROLE_KEY` / `VITE_SUPABASE_*` / `VITE_GEMINI_API_KEY` / `GEMINI_API_KEY` / `service_role` / `AIza…` | passes |

Run it yourself:

```bash
npm run verify:pg      # boots real PostgreSQL 18, applies migrations, runs the races
npm test               # 380 backend tests (SQLite runtime, unchanged)
npm run test:frontend  # 37 frontend tests
```

---

## DONE — live Supabase project (2026-09-01)

- Project `ninhoddowfweenhnkhbb` (ap-northeast-1, PostgreSQL 17.6). `.env` holds
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`), `SUPABASE_DB_URL`
  (session pooler). `DB_PROVIDER` still `sqlite`.
- `0001_schema.sql` + `0002_functions.sql` + `0003_grants.sql` applied →
  **19 public tables, 19 `bd_*` functions, RLS on all 19 tables**.
- End-to-end checks against the real project: `app_meta` read via PostgREST OK
  (`schema_version=10-pg`); `bd_claim_due_notifications` RPC via PostgREST →
  PL/pgSQL OK; anonymous read of `public.users` → **401 permission denied**
  (RLS + revoked grants confirmed).

## PENDING (application cutover)

1. **Run `npm run migrate:supabase -- --confirm`** to copy existing SQLite data
   (only if the local DB holds data worth keeping — otherwise re-seed).
3. **Port the repositories to `supabase-js`** — convert
   `backend/src/modules/**/**.repository.js` reads to `supabase.from(...).select(<explicit columns>)`
   and the transaction files (`*.transaction.js`) to single `supabase.rpc('bd_*', …)`
   calls. The PL/pgSQL already exists; this is wiring + `async/await` propagation
   through services/controllers.
4. **Swap the session store** — use `PgSessionStore` (with a `pg` Pool on
   `SUPABASE_DB_URL`) instead of `connect-sqlite3` when `DB_PROVIDER=supabase`.
5. **Make the background workers async** — `notification-worker`, `request-expiry`,
   `location-cleanup`, `surge-detector` currently call synchronous better-sqlite3;
   point them at `bd_claim_due_notifications` / `bd_expire_due_requests` / RPCs.
6. **Convert the test harness** — `backend/tests/helpers/*` provisions a temp
   SQLite file; add a Supabase/`pg` path (or keep SQLite as the test adapter and
   add a separate Supabase integration lane).
7. **Full race verification through `supabase-js` HTTP transport** — the SQL is
   proven (`verify:pg`, 32/32) and the PostgREST → RPC round-trip is confirmed
   working on the live project; re-running the concurrent allocation/pledge
   races through `supabase.rpc()` is the remaining check.
8. **Optional live Gemini smoke** — set `RUN_GEMINI_LIVE_TEST=true` with a real
   key to exercise `backend/src/integrations/gemini/gemini.client.js` end to end.
9. **Remove SQLite** — only after 3–7 are proven: delete `better-sqlite3`,
   `connect-sqlite3`, `backend/src/core/database.js` PRAGMA/WAL code, SQLite paths,
   `scripts/backup-db.js` / `restore-db.js` (replace with Supabase PITR / `pg_dump`
   guidance), and the SQLite session store. Keep a clearly test-only adapter if
   the test lane still uses SQLite.

Until step 9, `DB_PROVIDER=sqlite` is the supported runtime and there is **no
silent fallback** — `DB_PROVIDER=supabase` fails fast if the Supabase config is
absent.

---

## Notes carried into the other docs

- The phrase "the Gemini API key is the application's API" is **wrong** and has
  been corrected: `GEMINI_API_KEY` is a Google provider credential used only by
  the backend.
- The "fully offline" claim is **corrected**: cloud Supabase and Gemini both
  require network access. Gemini-independent features degrade safely when Gemini
  is unavailable, but a remote Supabase database is required unless a local
  Supabase/PostgreSQL is used.
- Backup/recovery: `VACUUM INTO` / local file copy is no longer the strategy once
  on Supabase — use Supabase point-in-time recovery or `pg_dump` against
  `SUPABASE_DB_URL`.
