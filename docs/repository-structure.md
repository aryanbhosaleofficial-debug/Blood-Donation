# Professional File and Folder Structure

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Repository Strategy

Use one monorepo:

```text
community-blood-donation-system/
├── backend/
├── frontend/
├── docs/
├── scripts/
├── data/
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

The backend and frontend remain clearly separated while sharing one repository for easy college submission and demonstration.

---

# 2. Full Recommended Structure

```text
community-blood-donation-system/
│
├── backend/
│   ├── src/
│   │   │
│   │   ├── app.js
│   │   ├── server.js
│   │   │
│   │   ├── core/
│   │   │   ├── config.js
│   │   │   ├── database.js
│   │   │   ├── errors.js
│   │   │   ├── logger.js
│   │   │   ├── response.js
│   │   │   └── constants.js
│   │   │
│   │   ├── security/
│   │   │   ├── csrf.js
│   │   │   ├── authorization.js
│   │   │   ├── rate-limit.js
│   │   │   ├── password.js
│   │   │   └── security-headers.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── require-role.js
│   │   │   ├── validate.js
│   │   │   ├── request-id.js
│   │   │   ├── not-found.js
│   │   │   └── error-handler.js
│   │   │
│   │   ├── modules/
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.service.js
│   │   │   │   ├── auth.repository.js
│   │   │   │   ├── auth.schemas.js
│   │   │   │   └── auth.constants.js
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── users.routes.js
│   │   │   │   ├── users.controller.js
│   │   │   │   ├── users.service.js
│   │   │   │   ├── users.repository.js
│   │   │   │   ├── users.schemas.js
│   │   │   │   └── users.serializer.js
│   │   │   │
│   │   │   ├── hospitals/
│   │   │   │   ├── hospitals.routes.js
│   │   │   │   ├── hospitals.controller.js
│   │   │   │   ├── hospitals.service.js
│   │   │   │   ├── hospitals.repository.js
│   │   │   │   └── hospitals.schemas.js
│   │   │   │
│   │   │   ├── blood-banks/
│   │   │   │   ├── blood-banks.routes.js
│   │   │   │   ├── blood-banks.controller.js
│   │   │   │   ├── blood-banks.service.js
│   │   │   │   ├── blood-banks.repository.js
│   │   │   │   └── blood-banks.schemas.js
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── inventory.routes.js
│   │   │   │   ├── inventory.controller.js
│   │   │   │   ├── inventory.service.js
│   │   │   │   ├── inventory.repository.js
│   │   │   │   ├── inventory.schemas.js
│   │   │   │   └── inventory.constants.js
│   │   │   │
│   │   │   ├── requests/
│   │   │   │   ├── requests.routes.js
│   │   │   │   ├── requests.controller.js
│   │   │   │   ├── requests.service.js
│   │   │   │   ├── requests.repository.js
│   │   │   │   ├── requests.schemas.js
│   │   │   │   ├── requests.policy.js
│   │   │   │   └── requests.serializer.js
│   │   │   │
│   │   │   ├── broadcasts/
│   │   │   │   ├── broadcasts.service.js
│   │   │   │   ├── broadcasts.repository.js
│   │   │   │   └── broadcasts.serializer.js
│   │   │   │
│   │   │   ├── allocations/
│   │   │   │   ├── allocations.routes.js
│   │   │   │   ├── allocations.controller.js
│   │   │   │   ├── allocations.service.js
│   │   │   │   ├── allocations.repository.js
│   │   │   │   ├── allocations.schemas.js
│   │   │   │   └── allocations.transaction.js
│   │   │   │
│   │   │   ├── donors/
│   │   │   │   ├── donors.routes.js
│   │   │   │   ├── donors.controller.js
│   │   │   │   ├── donors.service.js
│   │   │   │   ├── donors.repository.js
│   │   │   │   ├── donors.schemas.js
│   │   │   │   └── donors.serializer.js
│   │   │   │
│   │   │   ├── matching/
│   │   │   │   ├── compatibility.js
│   │   │   │   ├── donor-filter.service.js
│   │   │   │   ├── distance.service.js
│   │   │   │   ├── matching.constants.js
│   │   │   │   └── matching.service.js
│   │   │   │
│   │   │   ├── pledges/
│   │   │   │   ├── pledges.routes.js
│   │   │   │   ├── pledges.controller.js
│   │   │   │   ├── pledges.service.js
│   │   │   │   ├── pledges.repository.js
│   │   │   │   ├── pledges.schemas.js
│   │   │   │   ├── pledges.serializer.js
│   │   │   │   └── pledges.transaction.js
│   │   │   │
│   │   │   ├── locations/
│   │   │   │   ├── locations.routes.js
│   │   │   │   ├── locations.controller.js
│   │   │   │   ├── locations.service.js
│   │   │   │   ├── locations.repository.js
│   │   │   │   └── locations.schemas.js
│   │   │   │
│   │   │   ├── eta/
│   │   │   │   ├── eta.service.js
│   │   │   │   ├── eta.constants.js
│   │   │   │   └── eta.serializer.js
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── notifications.service.js
│   │   │   │   ├── notifications.repository.js
│   │   │   │   ├── notification-worker.js
│   │   │   │   ├── notification-provider.js
│   │   │   │   ├── notifications.constants.js
│   │   │   │   └── providers/
│   │   │   │       ├── in-app.provider.js
│   │   │   │       ├── email.provider.js
│   │   │   │       └── telegram.provider.js
│   │   │   │
│   │   │   ├── audit/
│   │   │   │   ├── audit.routes.js
│   │   │   │   ├── audit.controller.js
│   │   │   │   ├── audit.service.js
│   │   │   │   └── audit.repository.js
│   │   │   │
│   │   │   ├── metrics/
│   │   │   │   ├── metrics.routes.js
│   │   │   │   ├── metrics.controller.js
│   │   │   │   ├── metrics.service.js
│   │   │   │   └── metrics.repository.js
│   │   │   │
│   │   │   ├── surge/
│   │   │   │   ├── surge.routes.js
│   │   │   │   ├── surge.controller.js
│   │   │   │   ├── surge.service.js
│   │   │   │   ├── surge.repository.js
│   │   │   │   ├── baseline.service.js
│   │   │   │   ├── poisson.js
│   │   │   │   ├── scoring.service.js
│   │   │   │   ├── escalation.service.js
│   │   │   │   └── surge.constants.js
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── admin.routes.js
│   │   │   │   ├── admin.controller.js
│   │   │   │   ├── verification.service.js
│   │   │   │   └── admin.serializer.js
│   │   │   │
│   │   │   └── health/
│   │   │       ├── health.routes.js
│   │   │       └── health.controller.js
│   │   │
│   │   ├── jobs/
│   │   │   ├── request-expiry.job.js
│   │   │   ├── location-cleanup.job.js
│   │   │   ├── notification-worker.job.js
│   │   │   └── surge-analysis.job.js
│   │   │
│   │   └── utils/
│   │       ├── time.js
│   │       ├── ids.js
│   │       ├── math.js
│   │       ├── redaction.js
│   │       └── assert.js
│   │
│   ├── db/
│   │   ├── schema.sql
│   │   ├── seeds/
│   │   │   ├── seed-demo.js
│   │   │   ├── seed-users.js
│   │   │   ├── seed-inventory.js
│   │   │   └── seed-surge-baseline.js
│   │   └── queries/
│   │       └── debug.sql
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── compatibility.test.js
│   │   │   ├── eta.test.js
│   │   │   └── surge.test.js
│   │   ├── integration/
│   │   │   ├── auth.test.js
│   │   │   ├── requests.test.js
│   │   │   ├── allocations.test.js
│   │   │   ├── pledges.test.js
│   │   │   ├── privacy.test.js
│   │   │   └── cleanup.test.js
│   │   └── helpers/
│   │       ├── test-db.js
│   │       ├── login.js
│   │       └── fixtures.js
│   │
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── assets/
│   │       ├── icons/
│   │       └── images/
│   │
│   ├── src/
│   │   ├── main.js
│   │   │
│   │   ├── core/
│   │   │   ├── api-client.js
│   │   │   ├── csrf.js
│   │   │   ├── session.js
│   │   │   ├── router.js
│   │   │   ├── polling.js
│   │   │   └── config.js
│   │   │
│   │   ├── components/
│   │   │   ├── app-header.js
│   │   │   ├── nav.js
│   │   │   ├── loading.js
│   │   │   ├── error-banner.js
│   │   │   ├── status-badge.js
│   │   │   ├── modal.js
│   │   │   └── confirm-dialog.js
│   │   │
│   │   ├── modules/
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── login.page.js
│   │   │   │   ├── login.form.js
│   │   │   │   └── auth.service.js
│   │   │   │
│   │   │   ├── hospital/
│   │   │   │   ├── dashboard.page.js
│   │   │   │   ├── create-request.page.js
│   │   │   │   ├── request-detail.page.js
│   │   │   │   ├── request-history.page.js
│   │   │   │   ├── hospital.service.js
│   │   │   │   └── components/
│   │   │   │       ├── request-form.js
│   │   │   │       ├── allocation-list.js
│   │   │   │       └── donor-status-list.js
│   │   │   │
│   │   │   ├── bank/
│   │   │   │   ├── dashboard.page.js
│   │   │   │   ├── incoming-requests.page.js
│   │   │   │   ├── request-detail.page.js
│   │   │   │   ├── inventory.page.js
│   │   │   │   ├── allocation-history.page.js
│   │   │   │   ├── bank.service.js
│   │   │   │   └── components/
│   │   │   │       ├── inventory-table.js
│   │   │   │       ├── request-card.js
│   │   │   │       └── allocation-form.js
│   │   │   │
│   │   │   ├── donor/
│   │   │   │   ├── dashboard.page.js
│   │   │   │   ├── profile.page.js
│   │   │   │   ├── availability.page.js
│   │   │   │   ├── alerts.page.js
│   │   │   │   ├── pledge-detail.page.js
│   │   │   │   ├── donor.service.js
│   │   │   │   └── components/
│   │   │   │       ├── availability-control.js
│   │   │   │       ├── alert-card.js
│   │   │   │       └── location-sharing.js
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── dashboard.page.js
│   │   │       ├── verification.page.js
│   │   │       ├── audit.page.js
│   │   │       ├── notifications.page.js
│   │   │       ├── metrics.page.js
│   │   │       ├── surge.page.js
│   │   │       ├── admin.service.js
│   │   │       └── components/
│   │   │           ├── verification-table.js
│   │   │           ├── audit-table.js
│   │   │           ├── metrics-cards.js
│   │   │           └── surge-panel.js
│   │   │
│   │   ├── styles/
│   │   │   ├── reset.css
│   │   │   ├── tokens.css
│   │   │   ├── layout.css
│   │   │   ├── components.css
│   │   │   ├── forms.css
│   │   │   └── pages.css
│   │   │
│   │   └── utils/
│   │       ├── dom.js
│   │       ├── time.js
│   │       ├── validation.js
│   │       └── format.js
│   │
│   ├── tests/
│   │   ├── auth-ui.test.js
│   │   ├── xss-rendering.test.js
│   │   └── request-ui.test.js
│   │
│   ├── package.json
│   └── README.md
│
├── docs/
│   ├── Architecture.md
│   ├── Design.md
│   ├── Modules.md
│   ├── Rules.md
│   ├── Safety.md
│   ├── PRD.md
│   └── File_and_Folder_Structure.md
│
├── scripts/
│   ├── race-test.js
│   ├── pledge-race-test.js
│   ├── health-check.js
│   ├── backup-demo.js
│   └── reset-demo.js
│
├── data/
│   ├── .gitkeep
│   └── README.md
│
├── tests/
│   └── e2e/
│       ├── hospital-bank-flow.test.js
│       ├── donor-fallback.test.js
│       └── surge-demo.test.js
│
├── .env.example
├── .gitignore
├── package.json
├── LICENSE
└── README.md
```

---

# 3. Backend Module Pattern

Each significant backend domain module should follow the same pattern.

Example:

```text
modules/requests/
├── requests.routes.js
├── requests.controller.js
├── requests.service.js
├── requests.repository.js
├── requests.schemas.js
├── requests.policy.js
└── requests.serializer.js
```

## `*.routes.js`

Contains:

- path;
- HTTP method;
- middleware;
- controller.

No large business logic.

## `*.controller.js`

Contains:

- HTTP-specific input/output handling;
- invokes service;
- converts service result to HTTP response.

## `*.service.js`

Contains:

- domain rules;
- orchestration;
- business decisions.

## `*.repository.js`

Contains:

- SQL;
- database record operations.

## `*.schemas.js`

Contains:

- Zod input validation.

## `*.policy.js`

Contains:

- ownership/access logic when module-specific.

## `*.serializer.js`

Contains:

- safe response field selection;
- privacy control.

This makes it difficult to accidentally return private donor fields.

---

# 4. Transaction Files

Complex concurrency-sensitive logic gets a dedicated transaction file.

Examples:

```text
allocations.transaction.js
pledges.transaction.js
```

This highlights the academically important part of the project.

These files should contain the `.immediate()` transaction logic.

---

# 5. Frontend Module Pattern

Example:

```text
modules/hospital/
├── dashboard.page.js
├── create-request.page.js
├── request-detail.page.js
├── request-history.page.js
├── hospital.service.js
└── components/
```

## `*.page.js`

Page-level rendering and event registration.

## `*.service.js`

Role-specific API functions.

## `components/`

Reusable UI pieces for that domain.

---

# 6. Frontend XSS Rule

Create DOM utilities that encourage safe rendering.

Example:

```js
export function setText(element, value) {
    element.textContent = value ?? "";
}
```

Do not create a general helper that inserts arbitrary HTML from API data.

---

# 7. Database Directory

```text
backend/db/
├── schema.sql
├── seeds/
└── queries/
```

For the college project, one well-maintained `schema.sql` is acceptable.

If the schema later changes frequently, add:

```text
migrations/
```

with ordered files.

---

# 8. Data Directory

Runtime SQLite files belong under:

```text
data/
```

Example:

```text
data/
├── app.db
├── sessions.db
└── backups/
```

These files should normally be ignored by Git.

Seed scripts recreate demo state.

---

# 9. Testing Structure

Use three levels.

## Unit

Pure logic:

- compatibility;
- ETA banding;
- Poisson calculation;
- score calculation.

## Integration

Backend + SQLite:

- authentication;
- ownership;
- allocation;
- pledge concurrency;
- cleanup;
- privacy serializer.

## End-to-End

Full scenario:

```text
Hospital -> Bank -> Donor -> Completion
```

---

# 10. Root `package.json`

The root can coordinate the project.

Suggested scripts:

```json
{
  "scripts": {
    "dev:backend": "npm --prefix backend run dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "seed": "npm --prefix backend run seed",
    "test": "npm --prefix backend test",
    "race-test": "node scripts/race-test.js",
    "pledge-race-test": "node scripts/pledge-race-test.js",
    "health-check": "node scripts/health-check.js",
    "backup-demo": "node scripts/backup-demo.js"
  }
}
```

Exact commands can be adjusted when implementation begins.

---

# 11. `.env.example`

Recommended variables:

```text
NODE_ENV=development
PORT=3000

APP_ORIGIN=http://localhost:3000
APP_TIMEZONE=Asia/Kolkata

SESSION_SECRET=replace-me

DATABASE_PATH=./data/app.db
SESSION_DATABASE_PATH=./data/sessions.db

REQUEST_TTL_MINUTES=120
LOCATION_SESSION_TTL_MINUTES=30
AVAILABILITY_FRESHNESS_DAYS=7

NOTIFICATION_MAX_ATTEMPTS=3
POLL_INTERVAL_MS=3000

SURGE_PROBABILITY_THRESHOLD=0.01
SURGE_MINIMUM_COUNT=5
SURGE_LEVEL2_SCORE=40
SURGE_LEVEL3_SCORE=70
```

Do not place real secret values in `.env.example`.

---

# 12. `.gitignore`

```gitignore
node_modules/

.env
.env.*

!.env.example

data/*.db
data/*.db-shm
data/*.db-wal
data/backups/

coverage/
dist/
.DS_Store
```

---

# 13. Naming Conventions

## Files

```text
kebab-case.js
```

Examples:

```text
request-expiry.job.js
donor-filter.service.js
```

## Database

```text
snake_case
```

Examples:

```text
request_allocations
availability_updated_at
```

## JavaScript Variables

```text
camelCase
```

Examples:

```text
requestId
bloodGroup
```

## Constants

```text
UPPER_SNAKE_CASE
```

Example:

```text
MAX_NOTIFICATION_ATTEMPTS
```

---

# 14. Dependency Direction

Preferred:

```text
routes
  |
controllers
  |
services
  |
repositories
  |
database
```

Avoid:

```text
repository -> controller
service -> route
database -> frontend
```

Core utilities may be imported by domain modules, but domain modules should not create circular imports.

---

# 15. Recommended Implementation Start

Create only these directories first:

```text
backend/src/core
backend/src/security
backend/src/middleware
backend/src/modules/auth
backend/src/modules/users
backend/src/modules/health
backend/db
backend/tests

frontend/src/core
frontend/src/components
frontend/src/modules/auth
frontend/src/styles

scripts
data
docs
```

Then add domain modules phase-by-phase according to `Modules.md`.

This prevents the repository from becoming a large set of empty folders before the code exists.
