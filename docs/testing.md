# Testing

## Related documents

- [Demo Guide](demo-guide.md) — how to run the viva demo
- [Known Limitations](known-limitations.md)
- [Final Readiness](final-readiness.md)

## How to run everything

```bash
npm run verify            # backend tests + frontend tests + frontend build + both race tests
```

Individually:

```bash
npm run test:backend      # node --test "backend/tests/**/*.test.js"
npm run test:frontend     # vitest run (in frontend/)
npm run build:frontend    # vite production build
npm run race-test         # allocation concurrency (1-unit + 3-unit scenario)
npm run pledge-race-test  # donor-pledge concurrency + slot release
npm run race-test:multi   # both race tests, 10 deterministic rounds each
npm run demo:verify       # non-destructive demo readiness check
```

All test databases are per-file temporary SQLite files (`backend/tests/helpers/env.js`
+ per-file `mkdtempSync`). Tests never touch `data/app.db`. The race scripts also use
throwaway credentials in a temporary database and never read a real secret.

## What the suites prove

### Backend — `node --test` (368 tests)

| Area | Files (examples) | Proves |
|---|---|---|
| Foundation (M00) | `config.test.js`, `database.test.js`, `startup.test.js`, `health.test.js` | config validation, WAL + `foreign_keys=ON`, schema bootstrap idempotent, health contract |
| Identity & security (M01) | `unit/password.test.js`, `unit/csrf.test.js`, `integration/auth.test.js`, `session.test.js`, `authorization.test.js`, `rate-limit.test.js` | bcrypt policy, generic credential failure, lockout, session fixation regen, CSRF synchronizer token, Origin check, role guard, IP limiter |
| Organizations & inventory (M02) | `integration/module02.test.js`, `unit/inventory.test.js`, `unit/organization-serialization.test.js` | admin verify/revoke keeps `users.is_verified` ↔ `*.verified_at`, optimistic-concurrency inventory update, `requireVerified` live check |
| Emergency requests (M03) | `integration/request-*.test.js`, `unit/request-*.test.js` | idempotent create (`clientRequestId`), transactional broadcast fan-out, ownership + anti-enumeration 404, lifecycle states |
| Atomic allocation (M04) | `integration/allocation.test.js`, `unit/allocation-*.test.js`, `scripts/race-test.js` | `BEGIN IMMEDIATE` reserve, no over-allocation, exact inventory decrement, release restores in same transaction, COVERED/REOPENED transitions |
| Donor matching (M05) | `integration/donor-module.test.js`, `unit/compatibility.test.js`, `unit/donor-filter.test.js`, `unit/distance*.test.js` | RED_CELLS-only compatibility (component + group), availability freshness filter, distance ranking, private alerts, no donor identity to hospital |
| Pledges / location / ETA (M06) | `integration/pledge-module.test.js`, `unit/pledge-*.test.js`, `unit/eta*.test.js`, `scripts/pledge-race-test.js` | atomic pledge slot claim, capacity = `units_needed + backup_slots`, slot release, temporary location deleted on stop/close, coarse ETA/distance bands only |
| Notifications (M07) | `integration/*notification*.test.js` | transactional outbox (queued inside domain txn), worker retry/backoff, permanent-failure `FAILED`, restart recovery (rows persist), read state ≠ delivery state |
| Cleanup / audit / metrics (M08) | `integration/request-expiry*.test.js`, `location-cleanup.test.js`, `cleanup-startup.test.js`, `audit*.test.js`, `metrics-api.test.js`, `unit/audit-*.test.js`, `unit/metrics.test.js` | request expiry restores reserved inventory exactly once, physical location deletion, startup sweeps, append-only audit + key-dropping sanitizer, ADMIN-only aggregate metrics |
| Surge detection (M09) | `integration/surge-*.test.js`, `unit/poisson.test.js`, `unit/surge-*.test.js`, `unit/baseline.test.js` | Poisson upper-tail edge cases + monotonicity, multi-signal evidence, deterministic time-bucket dedupe, REAL/DEMO separation, human ADMIN confirm/reject, `409 INVALID_SURGE_STATE`, safe wording |
| End-to-end (M10) | `backend/tests/e2e/*.test.js` | whole workflows over real HTTP (see below) |

### End-to-end — `backend/tests/e2e/`

| File | Workflow |
|---|---|
| `hospital-bank-flow.test.js` | request → two banks reserve → COVERED → hospital sees allocations → outbox + audit rows exist, no PII |
| `donor-fallback-flow.test.js` | bank shortage → fallback → donor alert → pledge → arrival, hospital sees only `PDG-XXXX` |
| `location-flow.test.js` | share location → hospital sees ETA band only → stop → row deleted → band `UNAVAILABLE` |
| `notification-flow.test.js` | domain event → `QUEUED` → worker → `SENT` → user reads → `read_at` set |
| `expiry-flow.test.js` | past-due request with allocation + pledge + location → expired once → inventory restored once, second sweep is a no-op |
| `surge-flow.test.js` | control (normal demand → no candidate) + spike → `PENDING` → admin confirm → `ACTIVE` event + audit + notification + metrics |
| `security-regression.test.js` | unauthenticated + wrong-role blocked, CSRF + Origin required, IDOR blocked, no public surge/donor endpoints, GET is side-effect free |

### Frontend — `vitest` (34 tests)

`auth`, `hospital`, `blood-bank`, `donor`, `admin` (metrics + audit), `surge`
(dashboard + detail), `security` (repo-wide scan for `dangerouslySetInnerHTML` /
`innerHTML` / `insertAdjacentHTML` — must be zero), and `resilience` (401 → unauthorized
handler except on `/auth/me`, network failure → clean `ApiError`, `usePolling`
clears its timer on unmount, empty-state contract).

### Race scripts

- `race-test.js` — 1-unit request / 5 banks and 3-unit request / 5 banks, all racing.
  Invariant: `SUM(reserved) == units_needed`, total inventory decrement `== units_needed`,
  no negative inventory, request `COVERED`. `--rounds N` repeats.
- `pledge-race-test.js` — capacity 2, 5 donors race, then one cancels and a 6th pledges.
  Invariant: active pledges never exceed capacity; the released slot is reusable. `--rounds N` repeats.

Both exit `0` on success and non-zero on any invariant failure with a concise summary.

## Known test-runner note (Windows)

`better-sqlite3` + `node --test` on Windows can intermittently print a native
`Assertion failed: (env) != nullptr` line during **process teardown** (after all
assertions have already passed). It is cosmetic. Test files that were prone to it
lazy-`require` the notification worker and do DB setup in a `before` hook rather
than at module load; the CLI scripts do all work synchronously and then
`process.exit(code)`.
