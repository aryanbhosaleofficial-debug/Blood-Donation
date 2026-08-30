# System Modules and Implementation

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Purpose

This document organizes the system into numbered modules. Each module contains backend and frontend responsibilities, dependencies, expected deliverables, and minimum tests.

The modules are ordered to reduce rework and ensure that security and data integrity exist before user-facing features depend on them.

---

# Module 0 — Project Foundation

## Goal

Create a reproducible repository, configuration system, database bootstrap, coding conventions, and test harness.

## Backend Modules

### `core/config`

Responsibilities:

- load environment variables;
- validate required configuration;
- expose typed configuration values;
- define timezone and application policy values.

### `core/database`

Responsibilities:

- create/open SQLite database;
- enable `WAL`;
- enable foreign keys;
- configure busy timeout;
- execute schema migrations/bootstrap.

### `core/errors`

Responsibilities:

- define application error types;
- map domain errors to HTTP responses.

### `core/logger`

Responsibilities:

- application logging;
- redaction of sensitive values.

### `health`

Responsibilities:

- `/api/health`;
- database connectivity check;
- demo startup verification.

## Frontend Modules (React + Vite)

### `api/api-client.js` & `api/csrf-token.js`
Responsibilities:
- Fetch wrapper with `credentials: 'include'`;
- JSON parsing and ApiError normalization;
- Memory-only CSRF token injection on state-changing requests;
- Global 401 handling.

### `router/AppRouter.jsx` & `router/ProtectedRoute.jsx` & `router/RoleRoute.jsx`
Responsibilities:
- `BrowserRouter` SPA navigation;
- Authentication & role-aware route protection (`HOSPITAL`, `BLOOD_BANK`, `DONOR`, `ADMIN`).

### `context/AuthContext.jsx` & `context/CsrfContext.jsx`
Responsibilities:
- `GET /api/auth/me` session bootstrap;
- In-memory CSRF token synchronization;
- Safe login/logout lifecycle.

### `styles/index.css`
Responsibilities:
- Design tokens, responsive layout grid, status badges, forms, and cards.

## Deliverables

- repository starts with one command;
- database initializes;
- health endpoint works;
- environment configuration documented.

## Tests

- application starts from clean checkout;
- invalid configuration fails clearly;
- foreign keys enabled;
- database WAL mode enabled.

---

# Module 1 — Identity and Security

## Goal

Establish secure authentication before implementing domain actions.

## Backend Modules

### `auth`

Submodules:

```text
auth/
├── auth.routes.js
├── auth.controller.js
├── auth.service.js
├── auth.repository.js
├── auth.schemas.js
└── auth.middleware.js
```

Responsibilities:

- login;
- logout;
- session creation/destruction;
- generic invalid-credential response;
- failed-attempt tracking;
- temporary account lockout.

### `security/csrf`

Responsibilities:

- per-session CSRF token generation;
- Origin validation;
- token validation on state-changing requests.

### `security/rate-limit`

Responsibilities:

- unauthenticated login rate limiting;
- account-level request controls;
- avoid overly strict shared-IP throttling.

### `security/authorization`

Responsibilities:

- `requireAuth`;
- `requireRole`;
- reusable ownership authorization helpers.

### `users`

Responsibilities:

- user lookup;
- account status;
- organization/user verification state.

## Frontend Modules (React + Vite)

### `pages/auth/LoginPage.jsx` & `layouts/AuthLayout.jsx`
Responsibilities:
- Login form with accessible inputs;
- Generic error banner on credential failure;
- In-memory CSRF initialization post-authentication;
- Redirection to role-specific dashboard upon successful login.

## Deliverables

- secure session login/logout;
- CSRF token flow;
- role middleware;
- account lockout.

## Tests

- wrong password and unknown email return same message;
- session cookie is `httpOnly`;
- CSRF-less POST fails;
- invalid Origin fails;
- donor cannot call bank route;
- hospital cannot call admin route.

---

# Module 2 — Organization and Inventory Foundation

## Goal

Create verified hospital/blood-bank records and safe inventory management.

## Backend Modules

### `hospitals`

Responsibilities:

- hospital profile;
- verified organization lookup;
- hospital ownership link.

### `blood-banks`

Responsibilities:

- bank profile;
- bank ownership link;
- broadcast membership.

### `inventory`

Submodules:

```text
inventory/
├── inventory.routes.js
├── inventory.controller.js
├── inventory.service.js
├── inventory.repository.js
├── inventory.schemas.js
└── inventory.constants.js
```

Responsibilities:

- list bank inventory;
- update stock;
- record `updated_at`;
- prevent negative inventory;
- enforce `RED_CELLS` MVP component.

### `admin/verification`

Responsibilities:

- list pending organizations;
- verify/reject accounts;
- audit verification changes.

## Frontend Modules (React + Vite)

### `pages/blood-bank/InventoryPage.jsx` & `pages/blood-bank/BloodBankProfilePage.jsx`
Responsibilities:
- 8 red-cell inventory rows table;
- Inline unit adjustment with `INVENTORY_VERSION_CONFLICT` handling and automatic reload;
- Fresh/stale inventory indicator;
- Blood bank organization profile and verification state display.

### `pages/hospital/HospitalProfilePage.jsx`
Responsibilities:
- Hospital organization profile view/edit;
- Verification status display.

### `pages/admin/OrganizationVerificationPage.jsx`
Responsibilities:
- Pending/verified organization list;
- Verify and revoke action controls with CSRF-protected mutation.

## Deliverables

- verified bank accounts;
- verified hospital accounts;
- editable bank inventory;
- audit trail for inventory updates.

## Tests

- donor cannot edit inventory;
- bank can edit only its own inventory;
- units cannot become negative;
- unsupported component is rejected.

---

# Module 3 — Emergency Requests

## Goal

Allow verified hospitals to create secure, deduplicated, expiring requests.

## Backend Modules

### `requests`

Submodules:

```text
requests/
├── requests.routes.js
├── requests.controller.js
├── requests.service.js
├── requests.repository.js
├── requests.schemas.js
├── requests.policy.js
└── requests.serializer.js
```

Responsibilities:

- create request;
- idempotency using `client_request_id`;
- list hospital requests;
- secure request details;
- cancel/complete;
- TTL/expiry fields;
- synthetic-data flag.

### `request-access`

Responsibilities:

- hospital ownership checks;
- bank broadcast access checks;
- admin access;
- donor alert/pledge access.

### `broadcasts`

Responsibilities:

- create one broadcast row per bank;
- bank-specific incoming-request list;
- track `sent_at`/`responded_at`.

## Frontend Modules (React + Vite)

### `pages/hospital/CreateRequestPage.jsx` & `pages/hospital/RequestDetailPage.jsx` & `pages/hospital/RequestListPage.jsx`
Responsibilities:
- Emergency request creation form with idempotent `clientRequestId` generation and retry preservation;
- Live request details with multi-bank allocation status, donor fallback state, and coarse ETA bands;
- Hospital request history list and cancel/complete actions.

### `pages/blood-bank/IncomingRequestsPage.jsx` & `pages/blood-bank/BloodBankRequestDetailPage.jsx`
Responsibilities:
- Incoming broadcast requests list for verified blood banks;
- Request detail view with matching inventory verification and stock reservation action.

## Deliverables

- hospital can create one request;
- accidental duplicate submission is prevented;
- unauthorized request reads return inaccessible/not-found response;
- request automatically has expiry time.

## Tests

- double submit creates one logical request;
- Bank A cannot read a request never broadcast to Bank A;
- donor cannot enumerate request IDs;
- synthetic flag is admin/demo-controlled.

---

# Module 4 — Atomic Blood-Bank Allocation

## Goal

Support safe partial fulfillment across multiple blood banks.

## Backend Modules

### `allocations`

Submodules:

```text
allocations/
├── allocations.routes.js
├── allocations.controller.js
├── allocations.service.js
├── allocations.repository.js
├── allocations.schemas.js
└── allocations.transaction.js
```

Responsibilities:

- compute remaining units;
- reserve units;
- release units;
- complete allocation;
- use immediate transactions;
- maintain inventory consistency.

### `request-coverage`

Responsibilities:

- calculate active bank allocations;
- calculate donor pledges where relevant;
- derive request coverage status.

## Frontend Modules (React + Vite)

### `pages/blood-bank/AllocationHistoryPage.jsx` & `components/blood-bank/BankAllocationList.jsx`
Responsibilities:
- Active and past bank allocations list;
- Unit reservation, release, and completion controls;
- Clear status feedback on stock release and restoration.

### `components/hospital/HospitalAllocationList.jsx`
Responsibilities:
- Real-time display of allocated blood banks, units reserved, and remaining coordination requirement.

## Deliverables

- multiple banks can partially fulfill one request;
- no over-allocation;
- cancellation restores inventory.

## Tests

- simultaneous one-unit allocation accepts only one unit total;
- multi-bank 2+2 allocation can satisfy a four-unit request;
- released reservation restores exact inventory;
- transaction failure leaves no half-written allocation.

---

# Module 5 — Donor Registration and Matching

## Goal

Implement donor fallback without making clinical eligibility claims.

## Backend Modules

### `donors`

Responsibilities:

- donor profile;
- blood group;
- availability;
- availability freshness;
- locality/PIN;
- private contact fields;
- self-reported last donation/contact-after value.

### `matching`

Submodules:

```text
matching/
├── compatibility.js
├── donor-filter.service.js
├── distance.service.js
├── matching.constants.js
└── matching.test.js
```

Responsibilities:

- enforce `RED_CELLS`;
- return potential compatible groups;
- filter unavailable/stale donor profiles;
- rank/limit by approximate geography.

### `donor-alerts`

Responsibilities:

- determine which potential donors should receive an alert;
- avoid exposing donor list to hospital.

## Frontend Modules (React + Vite)

### `pages/donor/DonorProfilePage.jsx` & `components/donor/DonorProfileForm.jsx`
Responsibilities:
- Donor profile management form (blood group, locality, contact preferences);
- Privacy boundary: contact information remains strictly internal/donor-facing.

### `pages/donor/DonorAvailabilityPage.jsx` & `components/donor/AvailabilityControl.jsx`
Responsibilities:
- Available/unavailable toggle button;
- Freshness timestamp display with relative time formatting.

### `pages/donor/DonorAlertsPage.jsx` & `pages/donor/DonorAlertDetailPage.jsx` & `components/donor/AlertCard.jsx`
Responsibilities:
- Emergency alerts list targeted to compatible blood groups;
- Prominent clinical disclaimer ("Potential donor discovery only — does not guarantee medical eligibility");
- Mark as viewed lifecycle and pledge action trigger.

### `components/hospital/DonorFallbackStatus.jsx`
Responsibilities:
- Displays coarse potential-donor alert count and fallback status to hospital without exposing donor identities.

## Deliverables

- donor registration/profile;
- red-cell-only matching;
- safe potential-donor alerts.

## Tests

- plasma request cannot enter matching pipeline;
- incompatible blood group is not alerted;
- stale availability becomes unknown;
- hospital never receives donor contact list.

---

# Module 6 — Atomic Donor Pledges and Privacy

## Goal

Prevent donor-slot races and protect precise donor location.

## Backend Modules

### `pledges`

Submodules:

```text
pledges/
├── pledges.routes.js
├── pledges.controller.js
├── pledges.service.js
├── pledges.repository.js
├── pledges.transaction.js
└── pledges.serializer.js
```

Responsibilities:

- use `.immediate()` transaction;
- enforce pledge limit;
- prevent duplicate pledge;
- generate request-specific public reference.

### `location-sessions`

Responsibilities:

- start/update/stop temporary location sharing;
- store exact position only temporarily;
- enforce expiry;
- delete on request close.

### `eta`

Responsibilities:

- compute approximate distance;
- compute ETA band;
- compute distance band;
- never return raw coordinates.

## Frontend Modules (React + Vite)

### `pages/donor/DonorPledgesPage.jsx` & `pages/donor/DonorPledgeDetailPage.jsx`
Responsibilities:
- Donor pledge overview, cancel action, and mark arrived control;
- Clear status feedback on pledge lifecycle.

### `components/donor/LocationSharingControl.jsx`
Responsibilities:
- Explicit opt-in location sharing ("Start Location Sharing" button);
- Geolocation watch tracking with `useRef` and `clearWatch` on unmount or stop;
- One-click stop location sharing;
- Error handling and fallback to locality/PIN when browser geolocation is denied/unavailable.

### `components/hospital/DonorPledgeList.jsx`
Responsibilities:
- Displays pseudonymous donor references (`PDG-xxxx`);
- Displays coarse ETA bands (`15-30m`) and distance bands (`0-5km`);
- Zero access to donor private fields or live coordinates.

## Deliverables

- concurrent donor pledge protection;
- request-specific pseudonymous donor references;
- temporary location privacy.

## Tests

- pledge count never exceeds configured limit;
- same donor cannot pledge twice;
- no donor phone/email/coordinates in hospital network response;
- closing request physically removes location session.

---

# Module 7 — Notification Outbox and Polling

## Goal

Make alerting reliable without coupling emergency persistence to external providers.

## Backend Modules

### `notifications`

Submodules:

```text
notifications/
├── notifications.service.js
├── notifications.repository.js
├── notification-worker.js
├── notification-provider.interface.js
├── providers/
│   ├── in-app.provider.js
│   ├── email.provider.js
│   └── telegram.provider.js
└── notifications.constants.js
```

Responsibilities:

- queue;
- send;
- retry;
- fail safely;
- track timestamps.

### `polling`

Responsibilities:

- provide lightweight pending-alert endpoints;
- return only authorized data.

## Frontend Modules

### `shared/polling`

Responsibilities:

- poll active dashboard;
- retry on transient error;
- show disconnected state.

## Deliverables

- provider outage does not delete or roll back request;
- notification failures are visible to admin;
- alert dispatch timestamps can be measured.

## Tests

- forced provider exception leaves request intact;
- notification moves to retry/failed;
- unauthorized polling returns no data.

---

# Module 8 — Cleanup, Audit, and Metrics

## Goal

Prevent stale data and create defensible evaluation evidence.

## Backend Modules

### `jobs/request-expiry`

Responsibilities:

- expire old requests;
- release active reservations;
- expire pledges;
- remove location sessions.

### `jobs/location-cleanup`

Responsibilities:

- delete expired temporary coordinates.

### `audit`

Responsibilities:

- record security/domain events;
- redact sensitive metadata.

### `metrics`

Responsibilities:

- request latency;
- allocation latency;
- notification dispatch latency;
- donor acknowledgement latency;
- exclude synthetic rows.

## Frontend Modules

### `admin/audit`

Responsibilities:

- filter audit events;
- avoid showing secrets/private coordinates.

### `admin/metrics`

Responsibilities:

- Module 5 charts/tables;
- synthetic-data exclusion indicator.

## Deliverables

- no permanently open expired requests;
- physical location deletion;
- reproducible metrics.

## Tests

- expired request cleans allocations/locations;
- synthetic requests do not affect real metric query;
- audit entries exist for major mutations.

---

# Module 9 — Surge Detection

## Goal

Demonstrate statistical demand anomaly detection without claiming disaster prediction.

## Backend Modules

### `surge/baselines`

Responsibilities:

- local-time hour bucket generation;
- baseline query;
- synthetic baseline support.

### `surge/detector`

Responsibilities:

- Poisson tail calculation;
- minimum-count floor;
- confidence/dispersion checks.

### `surge/scoring`

Responsibilities:

- requester diversity;
- geographic concentration;
- depletion velocity;
- blood-group/component mix.

### `surge/escalation`

Responsibilities:

- generate recommendation;
- require admin confirmation for major escalation;
- cooldown/open-event behavior.

## Frontend Modules

### `admin/surge-dashboard`

Responsibilities:

- anomaly banner;
- evidence display;
- synthetic/demo label;
- confirm/reject controls.

## Deliverables

- injected synthetic surge is detected;
- UI states that it is an unusual demand pattern;
- major escalation requires admin action.

## Tests

- synthetic scenario triggers configured threshold;
- ordinary low-count activity does not trigger;
- system never automatically marks a disaster as confirmed.

---

# Module 10 — Evaluation and Demo Hardening

## Goal

Prepare a reliable CEP evaluation independent of network/phone failures.

## Modules

### `scripts/seed-demo`

- verified hospital;
- five blood banks;
- five donors;
- inventory;
- optional synthetic baseline.

### `scripts/race-test`

- simultaneous allocation test;
- simultaneous donor-pledge test.

### `scripts/health-check`

- server;
- database;
- required seed data.

### `scripts/backup-demo`

- copy SQLite database before viva.

## Deliverables

- reproducible demo;
- 5-volunteer test;
- script-based fallback;
- measurable timestamps.

## Minimum Demonstration

1. Create emergency request.
2. Show bank routing.
3. Fire simultaneous bank actions.
4. Demonstrate atomic result.
5. Trigger donor fallback.
6. Demonstrate pledge limits.
7. Show hospital API contains no private donor coordinates/contact.
8. Close request and prove location deletion.
9. Simulate notification failure.
10. Inject synthetic surge and require admin confirmation.

---

# Workflow Integration by Module

The detailed runtime flow is documented in [workflow.md](workflow.md).

Module mapping:

| Workflow Area | Primary Module |
|---|---|
| Login, session, CSRF, authorization | Module 1 |
| Bank inventory | Module 2 |
| Emergency request creation | Module 3 |
| Atomic bank allocation | Module 4 |
| Donor discovery | Module 5 |
| Atomic pledge + location privacy | Module 6 |
| Notification outbox | Module 7 |
| Expiry, cleanup, audit, metrics | Module 8 |
| Surge detection/admin confirmation | Module 9 |
| Mock crisis / race tests | Module 10 |
