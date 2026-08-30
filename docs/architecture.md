# Architecture

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Overview

The **Community Blood Donation Matching System** is a modular emergency sourcing platform designed for a college CEP project.

A verified hospital creates an emergency red-cell request. The platform checks available blood-bank inventory, broadcasts any remaining requirement to participating blood banks, and uses registered donors as a fallback source when inventory remains insufficient. A separate surge-detection layer analyzes request patterns and may recommend geographic escalation to an administrator.

The system is intentionally designed as a **coordination platform**, not a clinical transfusion system.

---

## 2. Architecture Goals

The architecture must:

- be simple enough for a college team to implement and demonstrate;
- remain secure against common student-project vulnerabilities;
- prevent duplicate claims and over-allocation during concurrent requests;
- keep donor identity, phone number, and precise location private;
- continue functioning when notification providers fail;
- produce measurable timestamps for CEP evaluation;
- isolate synthetic demo data from real project metrics;
- support local/offline-friendly demonstrations;
- provide a clear migration path from SQLite to PostgreSQL.

---

## 3. High-Level System Context

```text
+------------------------------------------------------+
|                 React + Vite Frontend                |
|  - React 18 SPA, React Router v6                     |
|  - AuthContext & CsrfContext (In-Memory CSRF)        |
|  - Role-specific UI Portals & Protected/Role Routes  |
+---------------------------+--------------------------+
                            |
                            | REST API (JSON)
                            | Session Cookie (HttpOnly)
                            | X-CSRF-Token (State-changing)
                            v
+------------------------------------------------------+
|                  Express Application                 |
|                                                      |
|  +-------------------+  +-------------------------+  |
|  | Authentication    |  | Authorization           |  |
|  | Session + CSRF    |  | Role + ownership        |  |
|  +-------------------+  +-------------------------+  |
|                                                      |
|  +-------------------+  +-------------------------+  |
|  | Request Routing   |  | Inventory Allocation    |  |
|  +-------------------+  +-------------------------+  |
|                                                      |
|  +-------------------+  +-------------------------+  |
|  | Donor Matching    |  | Donor Pledges           |  |
|  +-------------------+  +-------------------------+  |
|                                                      |
|  +-------------------+  +-------------------------+  |
|  | Notification      |  | Audit / Metrics         |  |
|  | Outbox + Worker   |  |                         |  |
|  +-------------------+  +-------------------------+  |
|                                                      |
|  +-------------------+  +-------------------------+  |
|  | Cleanup Jobs      |  | Surge Detection         |  |
|  +-------------------+  +-------------------------+  |
+---------------------------+--------------------------+
                            |
                            v
                     +-------------+
                     |   SQLite    |
                     +-------------+
```

---

## 4. Client Architecture (React + Vite)

The frontend is a single-page application built with **React 18** and bundled with **Vite**, using **React Router (v6)** for client-side routing. It interacts with the Express backend exclusively via REST APIs through the centralized `apiClient`.

### Key Frontend Principles:
- **Centralized API Client**: All HTTP requests flow through `frontend/src/api/api-client.js` with `credentials: 'include'`.
- **Memory-Only CSRF**: CSRF tokens are stored strictly in JavaScript runtime memory (`frontend/src/api/csrf-token.js`) and never written to `localStorage`, `sessionStorage`, or `IndexedDB`.
- **Auth Bootstrap**: The client bootstraps via `GET /api/auth/me` to determine session state, fetching `GET /api/auth/csrf-token` only after confirming an active authenticated session.
- **Route Protection**: `ProtectedRoute` and `RoleRoute` enforce authenticated role layouts for UX navigation while backend authorization remains mandatory and authoritative.

The frontend is organized into role-based portals:

### Hospital Portal
Responsibilities:
- authentication;
- emergency request creation with idempotent `clientRequestId`;
- request status monitoring and lifecycle management (cancel/complete);
- viewing multi-bank allocations;
- viewing pseudonymous donor pledge status (`PDG-xxxx`) with coarse ETA and distance bands;
- request cancellation/completion;
- strict privacy boundary: no access to donor names, phone numbers, emails, or precise coordinates.

### Blood Bank Portal
Responsibilities:
- authentication;
- 8 red-cell inventory row management with version-conflict detection and auto-reload;
- viewing broadcast emergency requests;
- reserving available inventory units;
- releasing reservations when needed;
- completing allocations;
- acknowledging stale inventory warnings.

### Donor Portal
Responsibilities:
- registration and login;
- blood group and availability status management;
- viewing emergency alerts targeted to compatible donors;
- atomic pledge creation;
- optional temporary location sharing triggered only by explicit user action;
- stopping location sharing with automatic geolocation watch cleanup (`clearWatch`).

### Admin Portal
Responsibilities:
- verify hospital and blood-bank registrations;
- inspect pending and verified organizations;
- review system audit logs and metrics.

---

## 5. Backend Architecture

The backend follows a layered modular structure.

```text
HTTP Request
    |
    v
Route
    |
    v
Authentication / CSRF
    |
    v
Role + Ownership Authorization
    |
    v
Zod Validation
    |
    v
Controller
    |
    v
Domain Service
    |
    +----> Repository / SQL
    |
    +----> Audit Service
    |
    +----> Notification Outbox
    |
    v
HTTP Response
```

### Route Layer

Defines:

- URL;
- HTTP method;
- middleware sequence;
- controller.

Routes contain minimal business logic.

### Controller Layer

Responsible for:

- reading validated request data;
- invoking domain services;
- mapping service results to HTTP responses.

### Service Layer

Contains business rules such as:

- request creation;
- bank allocation;
- release/rollback behavior;
- donor matching;
- pledge limits;
- request closure;
- surge analysis.

### Repository/Data Layer

Contains:

- parameterized SQL;
- transactions;
- record lookup;
- insert/update operations.

Application code must never concatenate untrusted input into SQL strings.

---

## 6. Authentication Architecture

The project uses **server-side sessions**.

### Why Sessions

For a single-process Node.js + SQLite application:

- logout is immediate;
- accounts can be disabled centrally;
- sessions can be revoked;
- no client-side token storage is needed;
- authorization state is simple.

### Session Cookie

Required settings:

```text
httpOnly = true
sameSite = "lax"
secure = true in production HTTPS
```

The session secret must come from environment configuration.

### CSRF

State-changing requests require:

1. an authenticated session;
2. an allowed `Origin`;
3. a valid per-session CSRF token.

---

## 7. Authorization Architecture

Authorization occurs at two levels.

### Role Authorization

Roles:

- `ADMIN`
- `HOSPITAL`
- `BLOOD_BANK`
- `DONOR`

Examples:

- only hospitals create emergency requests;
- only blood banks reserve bank inventory;
- only donors pledge as donors;
- only admins confirm high-level surge escalation.

### Resource Ownership Authorization

A valid role is not enough.

For example, `GET /api/requests/:id` is allowed only when:

- the logged-in hospital owns the request;
- the logged-in blood bank has a broadcast record for the request;
- the user is an admin;
- donor-specific endpoints confirm that the donor has an associated alert or pledge.

This prevents IDOR attacks even if record IDs are sequential.

---

## 8. Database Architecture

### Prototype Database

SQLite is intentionally used for:

- zero database-server setup;
- easy lab/viva demonstration;
- single-file backup;
- deterministic local testing.

Configuration:

```text
journal_mode = WAL
foreign_keys = ON
busy_timeout = 5000
```

### Concurrency Rule

Transactions that perform a **read → decision → write** operation must start with immediate write-lock semantics.

Examples:

- donor pledge slot reservation;
- multi-bank inventory reservation;
- bank reservation release;
- request expiry cleanup when inventory must be restored.

With `better-sqlite3`, these transactions are invoked with `.immediate()`.

### Production Migration

For multi-instance deployment or higher concurrency:

```text
SQLite -> PostgreSQL
```

The service/repository separation is intended to make this migration easier.

---

## 9. Request Routing Architecture

```text
Verified hospital
      |
      v
Create OPEN request
      |
      v
Check known blood-bank stock
      |
      v
Reserve units atomically
      |
      v
Remaining units?
   /       \
 no         yes
 |           |
 v           v
COVERED   Broadcast remaining requirement
             |
             v
        Banks reserve atomically
             |
             v
        Remaining units?
           /      \
          no       yes
          |         |
          v         v
       COVERED   Donor fallback
                    |
                    v
               Donor alerts
                    |
                    v
               Donor pledges
```

For O-negative requests, the application may be configured to alert potential O-negative donors earlier because the donor pool is limited. This is a project routing policy, not a clinical eligibility decision.

---

## 10. Inventory Allocation Architecture

The project supports partial fulfillment.

Example:

```text
Request: 4 units
Bank A: reserve 2
Bank B: reserve 1
Bank C: reserve 1
```

Allocation is recorded separately from the request.

The request itself remains a simple lifecycle entity.

### Allocation Transaction

Inside one immediate transaction:

1. read request;
2. compute already-reserved units;
3. compute remaining requirement;
4. read bank stock;
5. calculate `min(remaining, available)`;
6. conditionally decrement inventory;
7. insert allocation;
8. queue audit event;
9. commit.

If any required write fails, the transaction is rolled back.

---

## 11. Donor Matching Architecture

The MVP donor-matching layer supports only:

```text
component = RED_CELLS
```

This is enforced in:

- frontend choices;
- Zod schema;
- database `CHECK`;
- compatibility function guard.

### Potential Donor Filtering

Candidate discovery may consider:

- compatible registered blood group;
- active account;
- donor availability status;
- configured contact-after date / self-reported last donation information;
- approximate locality/distance;
- whether the donor already pledged to the request.

The application must call the result a **potential donor**, not an eligible donor.

Medical screening remains external.

---

## 12. Location and ETA Architecture

### Permanent Data

Permanent donor profiles should not contain precise home coordinates when they are unnecessary.

Preferred persistent data:

- locality;
- city;
- PIN code;
- optionally coarse approximate coordinates.

### Temporary Location Sharing

Exact latitude/longitude is accepted only after:

- the donor has pledged;
- the donor explicitly chooses to share location.

Temporary location records include `expires_at`.

Exact coordinates:

- remain server-side;
- are not returned to hospitals;
- are deleted when sharing ends, the request closes, or expiry occurs.

### Hospital View

Hospital-facing API returns only:

- request-specific pledge reference;
- ETA band;
- distance band;
- response status.

---

## 13. Notification Architecture

External notifications use an **outbox pattern**.

```text
Request transaction
    |
    +--> Insert business data
    +--> Insert notification rows as QUEUED
    |
    v
COMMIT
    |
    v
Background notification worker
    |
    +--> SENT
    +--> FAILED
    +--> retry if configured
```

Notification provider failure must never roll back the emergency request.

Possible demo channels:

- in-app polling;
- email;
- Telegram;
- Firebase Cloud Messaging.

---

## 14. Request Expiry and Cleanup Architecture

Open requests must not remain open forever.

Each request has:

- `created_at`;
- `expires_at`;
- `closed_at`.

A recurring cleanup job:

- finds expired open requests;
- releases reserved inventory where required;
- expires outstanding donor pledges;
- removes temporary donor locations;
- marks the request `EXPIRED`;
- records audit events.

Cleanup also runs immediately when a request is cancelled or completed.

---

## 15. Time Architecture

All stored timestamps use **UTC**.

Local timezone conversion occurs:

- in UI formatting;
- when computing explicitly local surge hour buckets.

For the project demo, the configured local timezone can be:

```text
Asia/Kolkata
```

Never mix SQLite UTC timestamps with local-hour assumptions.

---

## 16. Surge Detection Architecture

Surge detection is an advanced analytical module.

It does **not** predict disasters.

It detects:

> demand patterns that differ sharply from a configured or historical baseline.

Inputs may include:

- request count;
- distinct requesting hospitals;
- blood-group mix;
- geographic concentration;
- inventory depletion velocity;
- time-window baseline.

### Cold Start

The project can seed synthetic baseline data.

Synthetic data must:

- be flagged;
- never enter Phase 5 real-impact metrics;
- be described as synthetic in the report.

### Escalation

High-level escalation uses human confirmation:

```text
Detector -> Recommendation -> Admin Confirm/Reject
```

The algorithm does not autonomously redistribute blood across a state.

---

## 17. Deployment Architecture

### Recommended Viva/Demo Mode

```text
Examiner devices
      |
Local network / localhost
      |
Single Node.js process
      |
SQLite file
```

Advantages:

- no cloud cold start;
- no ephemeral storage loss;
- deterministic race tests;
- easy reseeding.

If phone geolocation is needed, use an HTTPS deployment or a locality/PIN fallback because browser geolocation is restricted on insecure non-localhost origins.

### Optional Cloud Mode

Requirements:

- HTTPS;
- persistent database storage;
- environment secrets;
- one application instance while using SQLite.

---

## 18. Reliability Boundaries

The architecture cannot guarantee:

- physical stock exactly matches the database;
- a potential donor passes medical screening;
- external notification delivery;
- donor turnout;
- road-accurate ETA;
- production-scale SQLite performance;
- clinically validated surge classification.

These are documented system boundaries.

---

# Workflow-to-Architecture Mapping

| Workflow Step | Architecture Component |
|---|---|
| Login | Authentication + Session Store |
| State-changing browser request | CSRF + Origin Validation |
| Role/resource access | Authorization Layer |
| Emergency request | Request Routing Service |
| Bank reservation | Allocation Service + Immediate Transaction |
| Donor discovery | Matching Service |
| Donor pledge | Pledge Service + Immediate Transaction |
| ETA | Location Session + ETA Service |
| Alert delivery | Notification Outbox + Worker |
| Expiry | Cleanup Jobs |
| Accountability | Audit Service |
| Demand anomaly | Surge Detection + Admin Review |

See [workflow.md](workflow.md) for the complete sequence.
