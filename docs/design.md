# Technical Design

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Design Objective

This document defines the detailed design of the **Community Blood Donation Matching System**.

The design prioritizes:

- correctness under concurrent bank/donor actions;
- medical-safety boundaries;
- privacy of donor contact and location information;
- secure session-based web access;
- measurable CEP evaluation;
- simple local demonstration;
- modularity for future migration to PostgreSQL or a richer frontend.

---

## 2. Domain Actors

### Hospital

A verified organization that creates emergency blood requests.

### Blood Bank

A verified organization that maintains inventory and reserves available units.

### Donor

A registered user who may receive alerts and pledge as a potential donor.

### Administrator

A privileged operator responsible for:

- organization verification;
- system oversight;
- audit review;
- surge escalation confirmation.

---

## 3. Request Lifecycle

The request state is intentionally small.

```text
OPEN
  |
  +--> COVERED
  |      |
  |      +--> COMPLETED
  |
  +--> CANCELLED
  |
  +--> EXPIRED
```

### `OPEN`

The request still requires coordination.

### `COVERED`

Recorded bank allocations and/or donor pledges are sufficient for the configured coordination target.

`COVERED` does not mean blood is clinically ready.

### `COMPLETED`

The request has been manually completed/closed by an authorized workflow.

### `CANCELLED`

The owning hospital or authorized admin cancelled the request.

### `EXPIRED`

The request passed its TTL without completion.

---

## 4. Allocation Lifecycle

```text
RESERVED
   |
   +--> COMPLETED
   |
   +--> RELEASED
```

### `RESERVED`

Bank inventory has been deducted and attached to a request.

### `RELEASED`

The reservation was cancelled and inventory was restored.

### `COMPLETED`

The bank allocation was completed in the project workflow.

---

## 5. Donor Pledge Lifecycle

```text
PLEDGED
   |
   +--> ARRIVED
   |
   +--> CANCELLED
   |
   +--> DEFERRED
   |
   +--> EXPIRED
```

A pledge remains a coordination response only.

It is not proof that the donor is medically eligible or that donated blood is ready.

---

## 6. Notification Lifecycle

```text
QUEUED
  |
  +--> SENT
  |      |
  |      +--> DELIVERED
  |      |
  |      +--> ACKNOWLEDGED
  |
  +--> FAILED
```

Not every provider can confirm `DELIVERED`.

The system must not falsely equate `SENT` with `DELIVERED`.

---

## 7. Data Model

### 7.1 `users`

```text
id
email
password_hash
role
hospital_id
bank_id
donor_id
is_verified
is_active
failed_login_attempts
locked_until
created_at
updated_at
```

### 7.2 `hospitals`

```text
id
name
registration_reference
contact_reference
city
locality
created_at
updated_at
```

Sensitive contact details should be limited to what is actually required for the prototype.

### 7.3 `blood_banks`

```text
id
name
license_no
city
locality
contact_reference
created_at
updated_at
```

### 7.4 `inventory`

```text
id
bank_id
blood_group
component
units_available
updated_at
```

Unique:

```text
(bank_id, blood_group, component)
```

MVP component constraint:

```text
component = RED_CELLS
```

### 7.5 `requests`

```text
id
client_request_id
hospital_id
blood_group
component
units_needed
backup_slots
urgency
status
note
is_synthetic
scenario_id
created_at
expires_at
closed_at
```

Unique:

```text
(hospital_id, client_request_id)
```

### 7.6 `request_broadcasts`

```text
id
request_id
bank_id
status
sent_at
responded_at
```

Unique:

```text
(request_id, bank_id)
```

### 7.7 `request_allocations`

```text
id
request_id
bank_id
units_reserved
status
reserved_at
released_at
completed_at
```

### 7.8 `donors`

```text
id
display_name
blood_group
phone_private
email_private
city
locality
pin_code
approx_latitude
approx_longitude
availability_status
availability_updated_at
last_donation_date
next_contact_after
created_at
updated_at
```

The application must never expose `phone_private`, `email_private`, or exact temporary coordinates in hospital-facing responses.

### 7.9 `donor_pledges`

```text
id
request_id
donor_id
public_reference
status
eta_band
distance_band
pledged_at
arrived_at
closed_at
```

Unique:

```text
(request_id, donor_id)
public_reference
```

### 7.10 `donor_location_sessions`

```text
donor_id
request_id
latitude
longitude
expires_at
created_at
updated_at
```

Primary/unique:

```text
(donor_id, request_id)
```

### 7.11 `notifications`

```text
id
request_id
recipient_user_id
channel
status
attempts
last_error
queued_at
sent_at
delivered_at
acknowledged_at
```

### 7.12 `audit_logs`

```text
id
actor_user_id
action
entity_type
entity_id
metadata_json
created_at
```

Audit metadata must not contain:

- passwords;
- session IDs;
- CSRF tokens;
- precise donor coordinates;
- secrets.

### 7.13 `baselines`

```text
id
city
blood_group
component
hour_bucket
mean_rate
variance
is_synthetic
created_at
```

### 7.14 `surge_events`

```text
id
city
started_at
score
classification_label
status
recommended_level
confirmed_by
confirmed_at
is_synthetic
```

---

## 8. Red-Cell Compatibility Design

The function signature must include the component.

```js
compatibleDonorGroups(component, recipientBloodGroup)
```

The function rejects unsupported components.

For `RED_CELLS`, the preliminary discovery map is:

| Recipient | Potential donor groups |
|---|---|
| O- | O- |
| O+ | O-, O+ |
| A- | O-, A- |
| A+ | O-, O+, A-, A+ |
| B- | O-, B- |
| B+ | O-, O+, B-, B+ |
| AB- | O-, A-, B-, AB- |
| AB+ | O-, O+, A-, A+, B-, B+, AB-, AB+ |

This table is used only to identify **potential donors**.

Final clinical compatibility remains outside the software.

---

## 9. Donor Candidate Design

Candidate query concept:

```text
compatible registered blood group
AND active account
AND availability is current
AND next_contact_after <= now, if configured
AND not already pledged
AND approximate location within configured discovery radius
```

### Availability Freshness

If donor availability is older than a configured freshness window:

```text
AVAILABLE -> UNKNOWN
```

This prevents a months-old availability choice from being treated as current.

---

## 10. Bank Allocation Algorithm

Pseudo-flow:

```text
BEGIN IMMEDIATE

request = read OPEN request
reserved = sum current active bank allocations
remaining = units_needed - reserved

if remaining <= 0:
    return ALREADY_COVERED

inventory = read bank stock
quantity = min(remaining, inventory.units_available)

if quantity <= 0:
    return NO_STOCK

conditional decrement inventory
insert request allocation
write audit event
queue required notification rows

COMMIT
```

If any write fails:

```text
ROLLBACK
```

---

## 11. Donor Pledge Algorithm

Pseudo-flow:

```text
BEGIN IMMEDIATE

request = read OPEN request
pledges = count active donor pledges
limit = units_needed + backup_slots

if pledges >= limit:
    return SLOTS_FULL

verify donor received/qualifies for alert context
verify donor has not already pledged
insert donor pledge
write audit event

COMMIT
```

Do not maintain a separate `donors_pledged` counter that can drift from the pledge rows.

---

## 12. Request Completion/Cancellation Design

### Cancellation

An immediate transaction:

1. verify hospital ownership/admin role;
2. release active bank allocations;
3. restore inventory;
4. expire/cancel donor pledges;
5. delete donor location sessions;
6. mark request `CANCELLED`;
7. audit.

### Expiry

Uses the same cleanup semantics, but marks the request `EXPIRED`.

### Completion

A completed request:

1. marks appropriate allocations/pledges closed;
2. deletes location sessions;
3. sets request `COMPLETED`;
4. records timestamps and audit events.

---

## 13. Expiry Job

A recurring process checks:

```text
status = OPEN
AND expires_at <= CURRENT_TIMESTAMP
```

The job must perform cleanup transactionally.

The job should also run once during application startup so expired rows are cleaned after downtime.

---

## 14. Temporary Location Cleanup

Cleanup occurs:

- on request completion;
- on request cancellation;
- on request expiry;
- when donor stops sharing;
- when `donor_location_sessions.expires_at` is reached.

A recurring cleanup query physically deletes expired rows.

An `expires_at` value without an actual deletion job is not considered sufficient.

---

## 15. ETA Design

### Input

Server-side only:

- temporary donor position;
- hospital/request location;
- configured road-factor approximation;
- configured speed assumption;
- configured preparation buffer.

### Output

Hospital receives only coarse output:

```json
{
  "pledgeReference": "PDG-XXXX",
  "etaBand": "15-20 min",
  "distanceBand": "5-10 km",
  "status": "PLEDGED"
}
```

### Privacy Controls

ETA is only available:

- for a verified request;
- after the donor pledges;
- while the donor has chosen to share location.

This reduces triangulation risk.

---

## 16. API Design

Base prefix:

```text
/api
```

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/csrf-token
```

### Hospital Requests

```text
POST   /api/requests
GET    /api/requests
GET    /api/requests/:requestId
POST   /api/requests/:requestId/cancel
POST   /api/requests/:requestId/complete
```

### Blood Bank

```text
GET    /api/bank/requests
GET    /api/bank/inventory
PATCH  /api/bank/inventory/:inventoryId
POST   /api/requests/:requestId/allocate
POST   /api/allocations/:allocationId/release
POST   /api/allocations/:allocationId/complete
```

The bank identity comes from the authenticated session, never from `req.body.bankId`.

### Donor

```text
GET    /api/donor/profile
PATCH  /api/donor/profile
PATCH  /api/donor/availability
GET    /api/donor/alerts
POST   /api/donor/alerts/:requestId/pledge
POST   /api/donor/pledges/:pledgeId/cancel
POST   /api/donor/pledges/:pledgeId/location
DELETE /api/donor/pledges/:pledgeId/location
```

### Admin

```text
GET    /api/admin/users/pending
POST   /api/admin/users/:userId/verify
GET    /api/admin/audit
GET    /api/admin/notification-failures
GET    /api/admin/surges
POST   /api/admin/surges/:surgeId/confirm
POST   /api/admin/surges/:surgeId/reject
```

---

## 17. HTTP Error Design

Use consistent JSON:

```json
{
  "error": {
    "code": "REQUEST_NOT_FOUND",
    "message": "Request not found"
  }
}
```

Recommended status codes:

| Status | Use |
|---|---|
| 200 | successful read/update |
| 201 | resource created |
| 400 | malformed/invalid request |
| 401 | unauthenticated |
| 403 | authenticated but not permitted |
| 404 | missing/inaccessible resource |
| 409 | state conflict / duplicate / already covered |
| 422 | optional validation response if preferred consistently |
| 429 | rate/account limit |
| 500 | unexpected server failure |
| 503 | temporary dependency failure where relevant |

Do not reveal stack traces in production responses.

---

## 18. XSS Design

User-supplied text is rendered with:

```js
element.textContent = value;
```

Never render API data using:

```js
element.innerHTML = value;
```

Where HTML templates are static, they are written by developers and not concatenated with untrusted data.

---

## 19. CSRF Design

State-changing routes require:

- valid authenticated session;
- valid `Origin`;
- valid `X-CSRF-Token`.

Safe methods:

```text
GET
HEAD
OPTIONS
```

must not mutate server state.

---

## 20. Login Security Design

### Passwords

- bcrypt;
- configurable work factor;
- minimum password length;
- no plaintext password logging;
- no hard-coded seed passwords in the repository.

### Lockout

Track failure count per account.

Prototype policy may temporarily lock after a configured number of failures.

### Enumeration

Use the same response for:

- unknown account;
- incorrect password.

---

## 21. Timezone Design

Storage:

```text
UTC
```

Display:

```text
configured local timezone
```

For this project:

```text
Asia/Kolkata
```

may be used for UI and local demand-hour analysis.

Never derive local hour buckets directly from UTC hour values.

---

## 22. Synthetic Data Design

All synthetic rows carry:

```text
is_synthetic = 1
```

Optional:

```text
scenario_id = "MASS_CASUALTY_DEMO_01"
```

Real Phase 5 metrics query only:

```text
is_synthetic = 0
```

The surge demo may explicitly include synthetic rows.

---

## 23. Surge Detection Design

Initial demo:

```text
lambda = expected requests in local time bucket
k = observed requests in window
flag if Poisson tail probability < configured threshold
and k >= configured minimum
```

Additional score inputs may include:

- requester diversity;
- geographic concentration;
- depletion velocity;
- blood-group mix.

Output language:

```text
Unusual demand surge detected
```

Permitted:

```text
Pattern is consistent with rapid red-cell demand increase.
```

Not permitted:

```text
Disaster confirmed.
```

Major escalation remains admin-confirmed.

---

## 24. Frontend Design

### Shared UI Principles

- role-specific navigation;
- accessible labels;
- no private donor fields in DOM;
- visible loading/error/retry states;
- confirmation for destructive actions;
- coarse ETA display;
- explicit "potential donor" wording;
- no medical eligibility claims.

### Hospital Screen Set

1. Login
2. Dashboard
3. Create Request
4. Request Details/Status
5. Request History

### Blood Bank Screen Set

1. Login
2. Incoming Requests
3. Request Detail / Allocation
4. Inventory
5. Allocation History

### Donor Screen Set

1. Register/Login
2. Donor Profile
3. Availability
4. Emergency Alerts
5. Pledge Detail / Location Sharing

### Admin Screen Set

1. Verification Queue
2. Open Requests
3. Audit Log
4. Notification Failures
5. Surge Review
6. Metrics

---

## 25. Polling Design

For the prototype:

```text
active dashboard polling: approximately every 3 seconds
```

The UI must:

- stop unnecessary polling when page is hidden where practical;
- display connection failure;
- retry after temporary errors;
- avoid claiming true real-time delivery.

For production scale, SSE/WebSockets are future options.

---

## 26. Configuration Design

Keep project policies in configuration rather than scattered constants.

Example:

```text
REQUEST_TTL_MINUTES
AVAILABILITY_FRESHNESS_DAYS
LOCATION_SESSION_TTL_MINUTES
NOTIFICATION_MAX_ATTEMPTS
POLL_INTERVAL_MS
SURGE_PROBABILITY_THRESHOLD
SURGE_MINIMUM_COUNT
SURGE_LEVEL2_SCORE
SURGE_LEVEL3_SCORE
APP_TIMEZONE
```

Medical/contact-window policies should be confirmed during fieldwork before being treated as domain rules.

---

## 27. Logging and Audit

Application logs are for debugging.

Audit logs are for accountability.

They are not the same.

### Application Logs

May include:

- route;
- request ID;
- status;
- execution duration;
- error code.

### Audit Logs

Contain:

- actor;
- action;
- entity;
- safe metadata;
- timestamp.

Never log:

- passwords;
- session cookie values;
- CSRF tokens;
- exact donor coordinates;
- private API credentials.

---

## 28. Demo Test Design

### Bank Concurrency Test

For a one-unit request:

- 5 blood-bank clients attempt allocation concurrently;
- exactly one unit is reserved;
- total inventory decreases by exactly one;
- no duplicate allocation occurs.

### Donor Slot Test

For a configured pledge limit:

- 5 donors pledge concurrently;
- accepted pledge count never exceeds the limit;
- duplicate donor pledge is rejected.

### Privacy Test

Open browser network tools and demonstrate:

- no donor phone;
- no donor email;
- no exact donor latitude/longitude;
- only coarse ETA/distance output.

### Cleanup Test

- donor begins location sharing;
- location row exists;
- close request;
- location row is physically deleted.

### Notification Failure Test

- simulate provider failure;
- request remains valid;
- notification row becomes retryable/failed;
- dashboard shows failure without losing request state.

---

# Workflow Design Traceability

Each detailed design area maps to a runtime workflow defined in [workflow.md](workflow.md):

- request state model -> Hospital Workflow;
- allocation state model -> Blood Bank Workflow;
- pledge model -> Donor Workflow;
- notification model -> Notification Workflow;
- location-session model -> ETA and Location Workflow;
- `expires_at` -> Request Expiry Workflow;
- `is_synthetic` -> Synthetic Demo Workflow;
- surge tables -> Surge Detection Workflow.
