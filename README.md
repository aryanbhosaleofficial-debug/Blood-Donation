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

### Backend
- Node.js
- Express
- SQLite
- `better-sqlite3`
- `express-session`
- bcrypt
- Zod
- Helmet
- Express Rate Limit

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
11. Frontend hardening
12. CEP mock crisis evaluation

**Implemented so far:** items 1–9 (Modules 0–8). Database `schema_version` 8.
Background workers: notification, request-expiry, location-cleanup — with
startup sweeps. Admin APIs: `GET /api/admin/metrics`, `GET /api/admin/audit-logs`
(both ADMIN-only, read-only). Surge detection (item 10+) is **not** implemented.

---

## Demo Strategy

The primary viva/demo setup should run locally on one laptop with SQLite.

Keep these ready:

- database backup
- seed script
- health-check script
- bank concurrency test
- donor pledge race test
- locality/PIN fallback if phone geolocation is unavailable

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
