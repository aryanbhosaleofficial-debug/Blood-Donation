# Known Limitations

This is a **college CEP prototype**. These limitations are intentional and are
stated openly for the viva and the project report.

## Platform / scale

- **Stack migration is mid-flight.** The official target is Supabase PostgreSQL +
  a backend-only Google Gemini integration. The PostgreSQL schema, transactional
  `rpc()` functions, grants/RLS, Supabase client, PostgreSQL session store, and
  Gemini foundation exist and are verified against a real PostgreSQL 18 server
  (`npm run verify:pg`), but the runtime still defaults to `DB_PROVIDER=sqlite`
  until a Supabase project is available for the cutover. See
  [MIGRATION-STATUS.md](MIGRATION-STATUS.md).
- **"Fully offline" applies only to `DB_PROVIDER=sqlite` + the IN_APP channel.**
  Cloud Supabase and the Gemini API both require network access. Gemini-independent
  features still work when Gemini is unavailable, but a remote Supabase database
  is required unless a local Supabase/PostgreSQL is used.
- **Backups: SQLite uses file snapshots** (`VACUUM INTO`); on Supabase this is
  replaced by Supabase point-in-time recovery or `pg_dump` against
  `SUPABASE_DB_URL`. `VACUUM INTO` / "copy `app.db`" is not the strategy once on
  PostgreSQL.
- **SQLite targets a single Node process.** WAL + `busy_timeout` handle
  local concurrency, but there is no distributed lock. A production multi-instance
  deployment would need PostgreSQL and a real job/lease coordinator; the
  background workers (notification, request-expiry, location-cleanup, surge
  detector) assume one loop per process.
- **No schema migration runner.** `backend/db/schema.sql` is idempotent
  (`CREATE TABLE IF NOT EXISTS`) and runs on every start. A database created by
  an earlier module gains new tables automatically, but a column whose
  constraints changed (e.g. `inventory_adjustments.actor_user_id` becoming
  nullable in Module 08) is only correct on a freshly created database. For the
  demo, `npm run demo:reset` gives a clean, current schema.
- **Backups are file snapshots** (`VACUUM INTO`), not point-in-time recovery.
  Restore requires the server to be stopped.

## Medical / clinical safety

- **"Potential donor" is not "medically eligible donor."** The system matches a
  self-reported blood group and availability. Screening, testing, and
  cross-matching are performed by qualified medical professionals and are
  entirely outside this software.
- **Red-cell compatibility mapping is discovery-only** and RED_CELLS-only. It is
  not a transfusion-safety engine and does not cover plasma, platelets, or
  antigen subtypes.
- **A bank allocation is not clinically ready blood.** "Units reserved" is
  recorded coordination movement, not proof of a tested, released unit.
- **A pledge / arrival is not a completed donation.** `ARRIVED → CLOSED` on
  request expiry acknowledges arrival without inferring any clinical outcome.
- **Recorded inventory may differ from physical stock.** It reflects the last
  value a bank entered; the UI shows staleness but cannot guarantee availability.
- **No clinical outcome prediction is performed anywhere.**

## Privacy / location

- **Exact donor location is opt-in, temporary, request-bound, and server-side.**
  It exists only in `donor_location_sessions` while sharing is active and is
  physically deleted on stop, pledge cancellation, request completion/cancellation,
  request expiry, and by the TTL cleanup job. It is never sent to the hospital,
  never logged, and never written to audit metadata.
- **The hospital never receives donor identity or contact** — only a
  request-specific `PDG-XXXXXX` reference, coarse ETA/distance bands, and status.
- **Browser live geolocation typically requires HTTPS** (or `localhost`). On a
  plain-HTTP LAN demo, `navigator.geolocation` may be unavailable; the workflow
  continues with ETA `Unavailable`.

## Notifications

- **The IN_APP provider is the guaranteed demo channel** (offline, idempotent,
  never fails). EMAIL / TELEGRAM / FCM are modelled in the schema but not wired
  to real providers.
- **Delivery is at-least-once.** If the process crashes after a provider accepts
  but before the row is marked `SENT`, the notification is retried on restart.
  The IN_APP provider is idempotent so this is harmless.

## Surge detection

- **It detects unusual *platform* blood-demand, not disasters.** It has no data
  about the outside world and never asserts an external cause. A `CONFIRMED`
  surge is an internal operational state, set only by a human ADMIN.
- **The synthetic baseline is a demo cold-start aid**, clearly flagged
  `is_synthetic = 1` / shown as `DEMO`. It is not learned real-world truth. REAL
  mode is skipped until at least `SURGE_MIN_BASELINE_DAYS` of real request
  history exists.
- **Thresholds** (`SURGE_P_VALUE_THRESHOLD`, `SURGE_MIN_REQUEST_COUNT`, …) are
  prototype values, not clinically or statistically validated for production.
- **No `STALE` auto-ageing** of old unreviewed candidates yet.

## Scope

- No public donor directory, no public surge/metrics/audit endpoints.
- No payments, no native mobile app, no WebSockets/SSE, no AI/LLM.
- Authentication is server-side sessions only (no JWT/OAuth).
