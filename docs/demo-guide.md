# Demo Guide (college viva)

A student should be able to follow this page start-to-finish. Every command
here matches a script in `package.json`.

## 0. One-time setup (clean checkout)

```bash
git clone <repo> && cd Blood-Donation
npm run setup            # ensure-env + npm install (root) + npm install (frontend)
```

`npm run setup` creates `.env` from `.env.example` with a fresh random
`SESSION_SECRET`. Adjust `.env` if you want (defaults work for a local demo).

## 1. Immediately before the demo — reset to a known state

```bash
npm run demo:reset       # DESTRUCTIVE for the local demo DB only; re-seeds + injects a fresh surge spike
npm run demo:verify      # prints "STATUS: READY" (exit 0) when the demo data is complete
```

`demo:reset` refuses to run when `NODE_ENV=production`. It clears every domain
table and re-creates the deterministic demo accounts, inventory, donor profiles,
the synthetic surge baseline, and 8 fresh synthetic Ahmedabad O- requests
(so the surge candidate is inside the current 60-minute window). Run it within
~50 minutes of demonstrating surge.

Optional: `npm run db:backup` writes a WAL-safe snapshot to `data/backups/`.

## 2. Start the app

```bash
npm run dev              # backend (:3000) + frontend (:5173) with one command
# or, in two terminals:
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`. Check `http://localhost:3000/api/health` returns
`{"status":"ok", ... "schemaVersion":"9"}`.

## 3. Demo accounts

All use the password in `DEMO_PASSWORD` (`.env` / `.env.example`, default
`demo-Passphrase-2024`). **DEMO ONLY — not a production credential.**

| Role | Email |
|---|---|
| ADMIN | `admin.demo@example.test` |
| HOSPITAL | `hospital.demo@example.test` |
| BLOOD_BANK | `bank1.demo@example.test`, `bank2.demo@example.test`, `bank3.demo@example.test` |
| DONOR | `donor1.demo@example.test` … `donor5.demo@example.test` (donor1/2 are O-) |

Seeded inventory (RED_CELLS): bank1 `O-=1, O+=2, A+=3`; bank2 `O-=1, B+=2`;
bank3 `O-=2, AB+=1`.

## 4. Five-volunteer plan (or one laptop)

| Volunteer | Role | Browser profile |
|---|---|---|
| 1 | Hospital | normal window |
| 2 | Blood Bank 1 | incognito window A |
| 3 | Blood Bank 3 | incognito window B |
| 4 | Donor 1 | separate browser / profile |
| 5 | Admin | separate browser / profile |

No phones required — use separate browser profiles / incognito windows on one
laptop. The authoritative concurrency proof is the automated race scripts (step 7).

---

## Scenario A — Successful multi-bank coverage

1. **Hospital** → *Create Request* → `O-`, `RED_CELLS`, `3` units, `CRITICAL`.
2. **Bank 1** → *Incoming Requests* → open it → *Reserve* (reserves its 1 O- unit).
3. **Bank 3** → *Incoming Requests* → *Reserve* (reserves 2 O- units).
4. **Hospital** → request detail now shows **COVERED** with two allocations
   (bank names + units — never donor data).

## Scenario B — Donor fallback (bank shortage)

1. **Hospital** → create `O-` / `3` units.
2. **Bank 2** → reserve its single `O-` unit → request stays **OPEN** (2 short).
3. **Hospital** → request detail → *Activate Potential Donor Fallback*.
4. **Donor 1** and **Donor 2** → *Alerts* → open the alert (clinical disclaimer
   shown) → *Pledge*.
5. **Hospital** → request detail → *Potential Donor Pledges* shows
   `PDG-XXXXXX` references + status only. A pledge does **not** make the request
   clinically covered.

## Scenario C — ETA (after a pledge)

1. **Donor 1** → *My Pledges* → open the pledge → *Start Location Sharing*
   (browser asks for geolocation permission).
2. **Hospital** → pledge summary shows an **ETA band** (e.g. `15–20 min`) and a
   **distance band** — no coordinates, no exact number.
3. **Donor 1** → *Stop Sharing* → the hospital ETA becomes **Unavailable**; the
   exact-location row is deleted immediately.
4. If geolocation is blocked/unavailable, the rest of the demo continues; ETA
   just stays `Unavailable`.

## Scenario D — Allocation race (automated)

```bash
npm run race-test          # 1-unit and 3-unit scenarios, 5 banks racing
npm run race-test:multi    # 10 rounds each
```

Expected: `exactly one` total unit reserved for the 1-unit case, `exactly 3`
for the 3-unit case, no negative inventory, request `COVERED`, exit `0`.

## Scenario E — Pledge race (automated)

Included in `race-test:multi`, or `npm run pledge-race-test`. Capacity 2,
5 donors race → `2` succeed, `3` get `SLOTS_FULL`; then one cancels and a
6th donor pledges successfully.

## Scenario F — Request expiry

1. Create an `O-` request, have a bank reserve part of it, have a donor pledge
   and share location.
2. In `psql`-equivalent — actually just wait for `REQUEST_TTL_MINUTES` (120 by
   default) **or** run the automated proof: `node --test backend/tests/e2e/expiry-flow.test.js`.
3. Expected: request `EXPIRED`, reserved inventory restored **once**, pledge
   `EXPIRED`, alert `CLOSED`, location row **deleted**, a `REQUEST_EXPIRED`
   notification queued, an audit row written. Running expiry again changes nothing.

## Scenario G — Surge detection

1. `npm run demo:reset` (injects the fresh Ahmedabad O- spike) and start the server.
   The startup detector pass raises a `PENDING` candidate within a few seconds.
2. **Admin** → *Surge Detection* → the dashboard shows a **DEMO** candidate:
   observed vs expected, upper-tail probability, distinct hospitals, score.
3. Open it → *Confirm Operational Surge* (dialog: "…does not confirm the external
   cause") **or** *Reject Candidate*.
4. On confirm: candidate `CONFIRMED`, an `ACTIVE` surge event appears, the admin
   gets a notification, `/api/admin/metrics` shows `surge.confirmedCandidates`
   and `surge.activeSurgeEvents` incremented.

The UI never says "disaster" — it says "unusual blood-demand pattern" /
"operational blood-demand surge".

---

## Failure fallbacks during the demo

| If… | Do this |
|---|---|
| a volunteer's browser won't log in | check `.env` `DEMO_PASSWORD`; re-run `npm run demo:verify` |
| geolocation is blocked | skip Scenario C's map step — ETA shows `Unavailable`, everything else works |
| the frontend dev server misbehaves | `npm run build:frontend` then serve `frontend/dist` with `npm --prefix frontend run preview` |
| demo data looks wrong | `npm run demo:reset` again (takes < 2 s) |
| the network drops | the whole demo is local (SQLite + IN_APP notifications) — nothing needs the internet |

## Likely viva questions

| Question | Answer |
|---|---|
| Why SQLite? | Single-file, zero-ops, perfect for a single-process college prototype and an offline viva. `better-sqlite3` is synchronous, which keeps the transaction code simple and race-safe. |
| Why WAL? | Readers don't block the writer, and `busy_timeout` handles brief write contention — realistic behaviour for the concurrency demos. |
| Why `BEGIN IMMEDIATE`? | Any *read → decide → write* (allocation, pledge slot, inventory restore, expiry) takes the write lock up front, so two racing requests serialise instead of both deciding on stale data. |
| How do you stop two banks taking the same unit? | The reserve transaction is `IMMEDIATE`; it re-reads remaining need + stock, decrements inventory with a conditional `UPDATE … WHERE units_available >= ?`, inserts the allocation (`UNIQUE(request_id,bank_id)`), and only then commits. The loser sees `ALREADY_COVERED` / `NO_STOCK`. |
| How do you stop too many donors pledging? | The pledge transaction counts active pledge rows against `units_needed + backup_slots` inside the same `IMMEDIATE` transaction; there is no separate counter to drift. |
| Why server-side sessions (not JWT)? | Simple revocation, no token-storage/XSS-exfil risk, and the whole app is one server. |
| Why CSRF protection? | The browser auto-sends the session cookie, so every state-changing route also checks a synchroniser token + a matching `Origin`/`Referer`. |
| Why doesn't the hospital see donor coordinates? | Hospital-facing responses only ever contain a request-specific `PDG-XXXX` reference + ETA/distance **bands**. Exact coordinates live only in `donor_location_sessions` while sharing is active and are deleted on stop/close/expiry. |
| Why is ETA a range? | Repeated precise ETAs could triangulate a donor. Bands + rate limits + request-scoped pseudonyms prevent that. |
| What is the transactional outbox? | Domain events write a `notifications` row **inside** the business transaction; a background worker delivers them afterwards. If the provider fails, the domain change is unaffected; delivery retries. |
| What happens on server restart? | Queued notifications persist in SQLite and resume; startup sweeps expire any requests / delete any locations that lapsed while offline; the surge detector re-runs. No in-memory queue. |
| How does surge detection work? | Poisson upper-tail test of observed vs baseline demand in a rolling 60-min window, plus explainable supporting signals (distinct hospitals, velocity, geographic concentration, inventory depletion) and a 0–100 ranking score. |
| Why is it not disaster prediction? | It only observes request data inside this platform. It can say "unusual O- demand in Ahmedabad"; it cannot establish the external cause. Every candidate needs a human ADMIN to confirm. |
| Why React + Vite? | Component model for role-specific dashboards, fast dev server, tiny production bundle, first-class testing with Vitest + Testing Library. |
