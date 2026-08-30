# Project Rules

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Purpose

These rules are mandatory development and domain constraints for the **Community Blood Donation Matching System**.

They exist to prevent accidental security, privacy, concurrency, medical-safety, and evaluation errors.

---

# A. Domain Rules

## Rule D1 — The application is a coordination system

The application must not claim to:

- approve a donor medically;
- authorize transfusion;
- replace screening;
- replace blood testing;
- replace cross-matching;
- determine clinical readiness.

Approved wording:

```text
Potential donor
Potentially compatible registered blood group
Estimated donor ETA
```

Prohibited wording:

```text
Eligible donor
Safe donor
Compatible for transfusion
Blood ready in X minutes
```

---

## Rule D2 — MVP donor matching is red-cells only

The MVP accepts donor compatibility matching only when:

```text
component = RED_CELLS
```

This must be enforced in:

- frontend form;
- request Zod schema;
- database constraint;
- compatibility function.

---

## Rule D3 — Donor compatibility function includes component

Required signature:

```js
compatibleDonorGroups(component, recipientBloodGroup)
```

A function accepting only blood group is prohibited.

---

## Rule D4 — Final medical suitability is external

Self-reported availability or donation history may reduce unnecessary alerts, but it must never be represented as clinical approval.

---

## Rule D5 — Request status must remain simple

Allowed request states:

```text
OPEN
COVERED
COMPLETED
CANCELLED
EXPIRED
```

Allocation, pledge, notification, and surge states belong in their own tables.

---

# B. Security Rules

## Rule S1 — Server-side sessions only for the MVP

Do not mix JWT authentication and session authentication.

The approved MVP uses server-side sessions.

---

## Rule S2 — Required cookie flags

Session cookie:

```text
httpOnly = true
sameSite = lax
secure = true in production HTTPS
```

Session secret comes from environment configuration.

---

## Rule S3 — CSRF protection required

All state-changing browser requests must pass:

- authentication;
- allowed-Origin check;
- CSRF token check.

---

## Rule S4 — Never trust identity from request body

Prohibited:

```js
const bankId = req.body.bankId;
```

Required:

```js
const bankId = req.session.user.bankId;
```

Same principle applies to:

- hospital identity;
- donor identity;
- admin identity.

---

## Rule S5 — Role checks are not enough

Every resource endpoint must also enforce ownership/access.

Example:

A `BLOOD_BANK` role does not allow reading every request.

The bank must have been broadcast that request or otherwise have explicit authorization.

---

## Rule S6 — Avoid account enumeration

Login failure response must not distinguish:

- unknown email;
- wrong password.

---

## Rule S7 — Passwords

- hash with bcrypt;
- never store plaintext;
- no default public repository password;
- minimum password policy;
- never log password values.

---

## Rule S8 — Account lockout

Failed attempts must be tracked per account, not only per IP.

Shared campus Wi-Fi must not cause normal demo users to be blocked by an overly strict global IP limit.

---

## Rule S9 — XSS

API/user data must be inserted into DOM using:

```js
textContent
```

not:

```js
innerHTML
```

unless the value is static developer-authored markup.

---

## Rule S10 — Secrets

Never commit:

- `.env`;
- session secret;
- email provider key;
- Telegram token;
- FCM key;
- production credentials.

---

# C. Privacy Rules

## Rule P1 — Hospital-facing APIs never return donor private contact data

Never return:

- donor phone;
- donor email;
- home address;
- exact live coordinates.

---

## Rule P2 — Exact location is temporary

Exact donor latitude/longitude can be stored only after explicit location-sharing opt-in for an active pledge.

---

## Rule P3 — Location must actually be deleted

A location expiry timestamp alone is insufficient.

Required behavior:

- deletion on stop sharing;
- deletion on request close;
- recurring expiry cleanup job;
- startup cleanup after downtime.

---

## Rule P4 — ETA only after pledge

Do not expose donor ETA for arbitrary donor IDs or arbitrary hospital coordinates.

ETA is visible only after the donor pledges to that verified request.

---

## Rule P5 — Use coarse output

Hospital sees:

```text
ETA band
Distance band
Pledge reference
Status
```

not precision suitable for location triangulation.

---

# D. Database and Concurrency Rules

## Rule DB1 — Foreign keys enabled

Required SQLite configuration:

```text
PRAGMA foreign_keys = ON
```

---

## Rule DB2 — WAL mode for prototype

Required:

```text
PRAGMA journal_mode = WAL
```

---

## Rule DB3 — Busy timeout

Configure a finite SQLite busy timeout.

---

## Rule DB4 — Parameterized SQL only

Never concatenate untrusted input into SQL.

---

## Rule DB5 — Immediate transaction for read-decide-write

Any operation with:

```text
read current state
make decision
write result
```

must use immediate write-lock semantics if concurrency matters.

Required examples:

- bank allocation;
- donor pledge slots;
- reservation release/restore;
- request expiry cleanup with inventory restoration.

With `better-sqlite3`, invoke transaction using:

```js
transaction.immediate(...)
```

---

## Rule DB6 — No redundant pledge counter

Do not store `donors_pledged` if it duplicates authoritative `donor_pledges` rows.

Count active pledge rows.

---

## Rule DB7 — Inventory never negative

Conditional updates must ensure:

```text
units_available >= amount_to_reserve
```

---

## Rule DB8 — Allocation release restores inventory in same transaction

No two-step non-transactional release.

---

# E. API Rules

## Rule API1 — Validate every mutable payload

Use Zod for:

- login;
- emergency request;
- inventory update;
- donor profile;
- pledge action parameters where applicable;
- admin actions.

---

## Rule API2 — Consistent errors

Use stable error codes.

Example:

```json
{
  "error": {
    "code": "ALREADY_COVERED",
    "message": "The request is already covered."
  }
}
```

---

## Rule API3 — Inaccessible resource may return 404

To reduce ID enumeration, an unauthorized user asking for an unrelated object may receive:

```text
404 Request not found
```

instead of confirming the object exists.

---

## Rule API4 — Safe GET

`GET`, `HEAD`, and `OPTIONS` must not mutate server state.

---

## Rule API5 — No raw model serialization

Do not:

```js
res.json(donorRow)
```

Use explicit serializers that select allowed fields.

---

# F. Notification Rules

## Rule N1 — Notification provider is never part of the critical DB transaction

Business data commits before external delivery.

---

## Rule N2 — Use notification outbox

Create:

```text
QUEUED
```

notification rows transactionally, then deliver later.

---

## Rule N3 — Do not confuse sent and delivered

Report only the strongest state the provider actually confirms.

---

## Rule N4 — Provider failure is visible

Failed notifications must be:

- stored;
- retryable where appropriate;
- visible to admin;
- excluded from false delivery-success metrics.

---

# G. Time and Data Rules

## Rule T1 — UTC storage

All database timestamps use UTC.

---

## Rule T2 — Explicit local conversion

Use configured timezone for:

- UI;
- local-hour surge bucket calculations.

For the project:

```text
Asia/Kolkata
```

---

## Rule T3 — Synthetic data is marked

Synthetic rows must include:

```text
is_synthetic = 1
```

---

## Rule T4 — Synthetic data excluded from real evaluation

CEP Phase 5 impact metrics query:

```text
is_synthetic = 0
```

unless the metric explicitly describes a synthetic experiment.

---

# H. Surge Rules

## Rule G1 — Do not call it disaster prediction

Approved:

```text
surge detection
unusual demand pattern
anomaly
```

Prohibited:

```text
AI predicts disasters
disaster confirmed by AI
```

---

## Rule G2 — High escalation requires human confirmation

The detector recommends.

An administrator confirms or rejects.

---

## Rule G3 — Thresholds are configuration

Do not scatter unexplained numeric constants throughout code.

---

## Rule G4 — Synthetic validation must be labelled

A detector tested on seeded data is demonstrated, not clinically validated.

---

# I. Frontend Rules

## Rule F1 — Role-specific UI

A user sees only controls relevant to the authenticated role.

Backend authorization remains mandatory even if UI hides controls.

---

## Rule F2 — Loading and failure states

Every asynchronous action must show:

- loading;
- success;
- useful error;
- retry/recovery where appropriate.

---

## Rule F3 — Geolocation fallback

Phone geolocation must not be the only method.

Provide:

- locality;
- PIN code;
- approximate area fallback.

---

## Rule F4 — No precise countdown pressure

ETA should be a band.

Avoid a constantly decreasing countdown that may encourage unsafe travel.

---

# J. Demo and Evaluation Rules

## Rule E1 — Demo must not depend on five phones

Maintain a script-based concurrency fallback.

---

## Rule E2 — Back up the database before viva

Keep:

- current demo DB;
- backup DB;
- seed script.

---

## Rule E3 — Cloud is optional, not the only demo environment

Local demo should remain possible.

---

## Rule E4 — Measure separate timestamps

Distinguish:

- request creation;
- matching;
- notification queued;
- notification sent;
- acknowledgement;
- bank allocation.

Do not combine them into one vague "notification time".

---

## Rule E5 — Report limitations before claiming impact

Required limitations include:

- stock synchronization;
- clinical eligibility;
- external notification guarantees;
- approximate ETA;
- synthetic surge validation;
- SQLite scale;
- donor turnout;
- external SMS/provider constraints.
