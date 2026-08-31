# Community Blood Donation Matching System

A college-level CEP project for emergency blood sourcing coordination.

The system allows verified hospitals to post urgent red-cell requests, checks participating blood-bank inventory, supports atomic partial allocation across banks, falls back to registered potential donors when required, and optionally detects unusual demand surges for administrator review.

> This platform is a coordination system. It does **not** replace blood-bank screening, testing, cross-matching, donor medical eligibility assessment, or clinical decision-making.

---

## Core Features

- Verified hospital, blood-bank, donor, and admin roles
- Session-based authentication and authorization
- CSRF protection and XSS-safe rendering
- Emergency request creation and expiry
- Blood-bank inventory management
- Concurrency-safe multi-bank allocation
- Donor fallback and red-cell potential matching
- Concurrency-safe donor pledges
- Privacy-first ETA and temporary location sharing
- Notification outbox with retry/failure tracking
- Audit logs and CEP evaluation metrics
- Optional surge detection with human confirmation

---

## Technology Stack

> **Migration in progress.** The official target stack is React + Vite → Express →
> **Supabase PostgreSQL** (`@supabase/supabase-js`) + **Google Gemini API**
> (backend only). The repository-side migration (PostgreSQL schema, transactional
> `rpc()` functions, grants/RLS, Supabase client, PostgreSQL session store, Gemini
> integration) is done and verified against a real PostgreSQL 18 server. The live
> cutover is pending a Supabase project — `DB_PROVIDER` defaults to `sqlite` and
> that runtime is fully tested. See **[docs/MIGRATION-STATUS.md](docs/MIGRATION-STATUS.md)**.

### Backend
- Node.js
- Express
- **Supabase PostgreSQL** via `@supabase/supabase-js` (target) · SQLite + `better-sqlite3` (current default, `DB_PROVIDER=sqlite`)
- **Google Gemini API** via `@google/genai` — backend only, disabled by default, advisory output only
- `express-session` (SQLite store now; PostgreSQL-backed `sessions` table after cutover)
- bcrypt
- Zod
- Helmet
- Express Rate Limit

`GEMINI_API_KEY` is a Google provider credential used only by the Express server —
it is **not** this application's API, is never sent to the browser, and never
appears in a `VITE_` variable.

### Frontend
- React 18
- Vite
- React Router (v6)
- React Context & Custom Hooks
- Vanilla CSS design tokens & responsive components
- Browser Geolocation API with locality/PIN fallback

---

## Project Workflow

The end-to-end workflow is documented in:

- [System Workflow](docs/workflow.md)

At a high level:

```text
Verified Hospital
      |
      v
Create Emergency Request
      |
      v
Validate + Authorize + Deduplicate
      |
      v
Check / Broadcast Blood-Bank Inventory
      |
      v
Reserve Units Atomically
      |
      v
Remaining Requirement?
   /        \
 No          Yes
 |            |
 v            v
Covered    Donor Fallback
               |
               v
        Alert Potential Donors
               |
               v
          Donor Pledges
               |
               v
     Optional ETA/Location Share
               |
               v
       Medical Staff Verification
               |
               v
      Complete / Cancel / Expire
```

---

## Documentation

| Document | Description |
|---|---|
| [PRD](docs/prd.md) | Product goals, users, requirements, acceptance criteria, risks, and roadmap |
| [Architecture](docs/architecture.md) | High-level architecture, security boundaries, deployment, concurrency, and infrastructure |
| [Technical Design](docs/design.md) | Detailed data model, API design, state model, algorithms, privacy, and error handling |
| [Workflow](docs/workflow.md) | End-to-end workflows for hospital, blood bank, donor, admin, notification, cleanup, and surge flows |
| [System Modules](docs/modules.md) | Backend/frontend modules organized into numbered modules |
| [Safety & Risk Controls](docs/safety.md) | Medical, privacy, cybersecurity, concurrency, notification, and operational safeguards |
| [Development Rules](docs/development-rules.md) | Mandatory engineering, security, privacy, API, database, and demo rules |
| [Repository Structure](docs/repository-structure.md) | Professional backend/frontend/module folder structure |

See the complete documentation index in [docs/README.md](docs/README.md).

---

## Quick Start & Running Locally

Requirements: Node.js 20+ (tested on 24) and npm.

### 1. Setup & Installation
```bash
npm run setup          # creates .env and installs root dependencies
cd frontend && npm install && cd ..  # installs frontend React dependencies
```

### 2. Running Locally

**Backend Server (Express API on `http://localhost:3000`):**
```bash
npm start              # starts Express backend server
# or for watch mode:
npm run dev
```

**Frontend Dev Server (React + Vite on `http://localhost:5173`):**
```bash
npm run dev:frontend   # starts Vite dev server with /api proxy to backend
```

### 3. Testing & Verification

```bash
npm test               # runs backend Node.js test suite (225 tests)
npm run test:frontend  # runs frontend Vitest suite (React testing library)
npm run build:frontend # builds frontend production bundle to frontend/dist
npm run race-test      # allocation concurrency test
npm run pledge-race-test # donor pledge concurrency race test
npm run health-check   # live health check against running backend
```

Configuration lives in `.env` (see `.env.example` for every variable). `backend/src/core/config.js`
is the only place that reads `process.env`; it fails fast with a readable message if a required
variable is missing or invalid.

---

## MVP Scope

The donor matching MVP supports:

```text
component = RED_CELLS
```

Supported blood groups:

```text
A+, A-, B+, B-, AB+, AB-, O+, O-
```

The system identifies **potential donors** only. Final medical suitability remains the responsibility of medical professionals.

---

## Recommended Development Order

1. Project foundation and database
2. Authentication, CSRF, roles, and ownership
3. Organization verification and inventory
4. Emergency request creation
5. Atomic bank allocation
6. Donor registration and matching
7. Atomic donor pledges and privacy
8. Notification outbox
9. Cleanup, audit, and metrics
10. Surge detection
11. Testing, demo hardening & final project readiness

All eleven planned modules (00–10) are implemented, tested, and demo-ready.

**Status: COMPLETE — Modules 00–10 (`schema_version` 9), v1.0.0.**
Background workers: notification, request-expiry, location-cleanup, surge
detector (startup passes/sweeps + recurring). Admin APIs: `GET /api/admin/metrics`,
`GET /api/admin/audit-logs`, `GET/POST /api/admin/surge/*` (all ADMIN-only; surge
mutations CSRF-protected). Surge detection finds **unusual blood-demand patterns**
for human ADMIN review — it does **not** predict disasters and never auto-confirms.

See [docs/final-readiness.md](docs/final-readiness.md), [docs/testing.md](docs/testing.md),
[docs/demo-guide.md](docs/demo-guide.md), and [docs/known-limitations.md](docs/known-limitations.md).

---

## Installation (clean checkout)

```bash
npm run setup           # copies .env.example -> .env (fresh SESSION_SECRET) + installs backend & frontend deps
```

Requires Node >= 20. With the default `DB_PROVIDER=sqlite` the whole demo runs
locally (SQLite + IN_APP notifications) with no internet after install. With
`DB_PROVIDER=supabase` the database is remote and network access is required;
with `GEMINI_ENABLED=true` the Gemini API is reached over the network too.
Gemini-independent features degrade safely when Gemini is unavailable.

## Configuration

Every variable is documented in [.env.example](.env.example) and read only by
`backend/src/core/config.js`. Defaults are demo-safe; set a real random
`SESSION_SECRET` for anything shared. `DEMO_PASSWORD` is **DEMO ONLY**.

## Development

```bash
npm run dev             # backend (:3000) + frontend (:5173), one command
npm run dev:backend     # backend only (node --watch)
npm run dev:frontend    # frontend only (vite)
```

## Testing

```bash
npm run verify          # backend tests + frontend tests + frontend build + both race tests
npm run test:backend    # 368 tests (node --test)
npm run test:frontend   # 34 tests (vitest)
npm run race-test       # allocation concurrency proof
npm run pledge-race-test
npm run race-test:multi # 10 deterministic rounds of each race
```

## Demo reset & verification

```bash
npm run demo:reset      # DESTRUCTIVE for the local demo DB only; re-seeds + injects a fresh surge spike
npm run demo:verify     # non-destructive readiness check -> "STATUS: READY", exit 0
npm run demo:check      # demo:verify + frontend-build-artefact check
```

`demo:reset` refuses to run when `NODE_ENV=production`. Full walkthrough in
[docs/demo-guide.md](docs/demo-guide.md).

## Demo accounts

Deterministic `@example.test` accounts, all using `DEMO_PASSWORD`:
`admin.demo`, `hospital.demo`, `bank1/2/3.demo`, `donor1..5.demo`.
Not production credentials.

## Backup

```bash
npm run db:backup       # WAL-safe VACUUM INTO snapshot -> data/backups/ (git-ignored)
npm run db:restore --from data/backups/<file>.db --yes   # server must be stopped; refuses in production
```

---

## Important Limitations

The project does not guarantee:

- that physical stock exactly matches the database;
- donor medical eligibility;
- external notification delivery;
- donor turnout;
- road-accurate ETA;
- production-scale SQLite performance;
- clinically validated surge classification.

These are documented system boundaries, not hidden assumptions.
