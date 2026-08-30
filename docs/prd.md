# Product Requirements Document (PRD)

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## Product

**Community Blood Donation Matching System**

## Document Status

College CEP — Phase 3 Technology Development

---

# 1. Product Summary

The Community Blood Donation Matching System is an emergency sourcing portal that helps verified hospitals coordinate red-cell requirements with participating blood banks and registered potential donors.

The platform operates in two sourcing tiers:

1. blood-bank inventory;
2. donor fallback.

An advanced optional feature detects unusual demand surges across requests and recommends wider escalation to an administrator.

The product is a coordination system and does not replace blood-bank medical procedures.

---

# 2. Problem Statement

During emergencies, families and hospitals may need to contact multiple blood banks or individual donors manually. This process can be fragmented, slow, difficult to measure, and prone to duplicate effort.

The project aims to centralize:

- emergency request creation;
- blood-bank stock routing;
- partial allocation;
- donor alerting;
- donor response;
- status tracking;
- evaluation metrics.

---

# 3. Product Goals

## G1 — Faster Coordination

Reduce time between emergency request submission and the first useful bank/donor response.

## G2 — Correct Concurrent Allocation

Prevent multiple banks or donors from claiming the same limited slot due to race conditions.

## G3 — Donor Privacy

Avoid exposing private donor phone numbers and precise location to hospitals.

## G4 — Reliable Request Persistence

An external notification failure must not cause an emergency request to disappear or roll back.

## G5 — CEP Measurability

Record timestamps that allow the group to calculate:

- request creation-to-routing time;
- bank response/allocation time;
- notification dispatch time;
- donor acknowledgement time.

## G6 — Demonstrable Security

The project should visibly demonstrate:

- authentication;
- roles;
- ownership checks;
- CSRF protection;
- XSS-safe rendering;
- transactional concurrency controls.

---

# 4. Non-Goals

The MVP does not:

- determine medical donor eligibility;
- authorize blood transfusion;
- perform laboratory cross-matching;
- maintain full per-blood-unit laboratory records;
- provide medical diagnosis;
- guarantee physical inventory accuracy;
- provide road-navigation-quality ETA;
- perform donor matching for plasma;
- perform donor matching for platelets;
- autonomously confirm disasters;
- replace hospital/blood-bank information systems.

---

# 5. Users

## 5.1 Hospital User

Needs to:

- create urgent request;
- monitor sourcing status;
- view bank allocations;
- view pseudonymous donor responses;
- cancel/complete request.

## 5.2 Blood Bank User

Needs to:

- maintain stock;
- view incoming requests;
- reserve available units;
- release allocation if required;
- complete allocation.

## 5.3 Donor User

Needs to:

- register profile;
- maintain availability;
- receive relevant alerts;
- pledge/decline;
- optionally share temporary location;
- stop location sharing.

## 5.4 Administrator

Needs to:

- verify accounts;
- inspect system activity;
- inspect failures;
- review metrics;
- confirm/reject high-level surge recommendation.

---

# 6. Primary User Stories

### Hospital

**H-1**  
As a verified hospital, I want to submit an emergency red-cell request so that available sources can be contacted.

**H-2**  
As a hospital, I want to see how many units are reserved so that I understand coordination progress.

**H-3**  
As a hospital, I want to see donor ETA bands without seeing donor private location/contact information.

### Blood Bank

**B-1**  
As a blood bank, I want to see requests broadcast to my bank.

**B-2**  
As a bank, I want to reserve only units I actually have.

**B-3**  
As a bank, I want concurrent reservations to remain correct even if other banks respond simultaneously.

### Donor

**D-1**  
As a donor, I want to receive only potentially relevant alerts.

**D-2**  
As a donor, I want to pledge without exposing my phone/location directly to the hospital.

**D-3**  
As a donor, I want location sharing to be optional and stoppable.

### Admin

**A-1**  
As an admin, I want to verify organizations before they can create or fulfill requests.

**A-2**  
As an admin, I want an audit trail for important actions.

**A-3**  
As an admin, I want to review a surge recommendation before major escalation occurs.

---

# 7. Functional Requirements

## FR-1 Authentication

The system shall provide session-based login and logout.

Acceptance:

- unauthenticated protected route returns `401`;
- logout invalidates session.

---

## FR-2 Account Verification

Only verified hospital and blood-bank accounts may use organization-specific emergency functions.

---

## FR-3 Role Authorization

The system shall enforce:

```text
ADMIN
HOSPITAL
BLOOD_BANK
DONOR
```

on backend routes.

---

## FR-4 Ownership Authorization

The system shall verify access to each resource.

Example:

A bank may read a request only if the request was broadcast to that bank or explicit policy allows access.

---

## FR-5 CSRF Protection

State-changing browser routes shall reject invalid/missing CSRF protection.

---

## FR-6 Emergency Request Creation

Verified hospitals can create:

```text
blood_group
component = RED_CELLS
units_needed
urgency
note
client_request_id
```

The server supplies:

- hospital identity;
- timestamps;
- status;
- expiry.

---

## FR-7 Duplicate Request Protection

The same hospital + `client_request_id` shall not create duplicate logical requests.

---

## FR-8 Request Expiry

Each request shall expire after a configurable TTL unless completed/cancelled first.

---

## FR-9 Inventory Management

Banks can maintain:

- blood group;
- red-cell units;
- last-updated timestamp.

---

## FR-10 Partial Bank Allocation

Multiple banks may reserve units toward one request.

---

## FR-11 Atomic Allocation

Concurrent allocations shall not:

- over-reserve request units;
- make inventory negative;
- create half-written reservation state.

---

## FR-12 Allocation Release

A released allocation shall restore the correct inventory in the same transaction.

---

## FR-13 Donor Profile

Donor profile shall support:

- blood group;
- availability;
- locality/PIN;
- private contact fields;
- self-reported last donation/contact-after data.

---

## FR-14 Potential Donor Matching

The system shall identify potential donors using red-cell discovery rules.

The output shall not claim medical eligibility.

---

## FR-15 Donor Pledge

A donor can pledge once per request.

Pledge capacity shall be concurrency-safe.

---

## FR-16 Donor Privacy

Hospital-facing output shall not include:

- phone;
- email;
- exact location;
- reusable internal donor ID.

---

## FR-17 Temporary Location Sharing

After pledge, donor may opt into temporary location sharing.

Location must:

- expire;
- be deletable;
- be deleted on request close.

---

## FR-18 ETA Band

Hospital may receive an approximate ETA/distance band after a donor pledge and location-share opt-in.

---

## FR-19 Notification Outbox

Notification delivery shall be decoupled from the core request transaction.

---

## FR-20 Notification Failure

Provider failure shall not invalidate the emergency request.

---

## FR-21 Audit Log

System shall audit important mutations.

---

## FR-22 Synthetic Data Isolation

Synthetic/demo data shall be marked and excluded from real Phase 5 metrics.

---

## FR-23 Surge Detection

Advanced module shall detect unusual request demand against a baseline.

---

## FR-24 Human Surge Confirmation

High-level escalation recommendation shall require admin confirmation.

---

# 8. Non-Functional Requirements

## NFR-1 Security

The system shall implement:

- secure session cookie;
- CSRF;
- bcrypt password hashing;
- account lockout;
- role authorization;
- ownership authorization;
- XSS-safe rendering;
- parameterized SQL.

---

## NFR-2 Privacy

Private donor fields shall not be present in hospital API payloads.

---

## NFR-3 Concurrency

SQLite critical read-decide-write transactions shall use immediate transaction semantics.

---

## NFR-4 Reliability

External notification failure shall not roll back committed domain data.

---

## NFR-5 Performance

For the college demo with small seeded datasets:

- request API should normally respond interactively;
- polling interval target is approximately 3 seconds;
- matching/transaction operations should remain fast enough for live demonstration.

No production-scale SLA is claimed.

---

## NFR-6 Portability

The application shall run locally on a normal development laptop.

---

## NFR-7 Recoverability

The demo shall support:

- database backup;
- reseeding;
- clean startup;
- race-test fallback script.

---

## NFR-8 Time Consistency

All stored timestamps shall use UTC.

---

# 9. Success Metrics

## Phase 3 Technical Metrics

- atomic allocation correctness;
- atomic donor pledge correctness;
- no private donor fields in hospital API;
- successful request cleanup;
- notification failure isolation.

## Phase 5 CEP Evaluation Metrics

Suggested:

```text
Request routing latency
Bank acknowledgement/allocation latency
Notification dispatch latency
Donor acknowledgement latency
Successful/failed notification count
Number of test participants
User feedback score
```

Synthetic rows are excluded from real user-impact metrics.

---

# 10. Mock Crisis Acceptance Scenario

## Scenario A — Bank Concurrency

Given:

- one open request;
- one remaining bank unit needed;
- five bank clients act at approximately the same time.

Expected:

- no more than one unit total is reserved;
- inventory decreases exactly once;
- no negative stock;
- conflict responses are handled cleanly.

---

## Scenario B — Donor Fallback

Given:

- no sufficient bank stock;
- potential red-cell donors exist.

Expected:

- donor alerts are queued;
- donor identities remain private;
- pledge slot count does not exceed configured limit;
- ETA returned only after pledge/location opt-in.

---

## Scenario C — Cleanup

Given:

- donor is actively sharing location.

When:

- request completes/cancels/expires.

Expected:

- exact location row is physically deleted.

---

## Scenario D — Notification Failure

Given:

- notification provider is forced to fail.

Expected:

- request remains valid;
- notification becomes retryable/failed;
- admin can inspect failure.

---

## Scenario E — Surge Demo

Given:

- synthetic 30-day baseline;
- injected synthetic request surge.

Expected:

- detector flags unusual demand;
- UI labels scenario as synthetic/demo;
- high escalation waits for admin confirmation.

---

# 11. Risks

| Risk | Mitigation |
|---|---|
| Fake requests | verified hospitals, session auth, account limits |
| Bank impersonation | bank identity from session only |
| IDOR | ownership/access checks |
| XSS | `textContent`, Helmet |
| CSRF | CSRF token + Origin check |
| Race conditions | `.immediate()` transactions |
| Donor privacy leakage | explicit serializers, pseudonymous pledge references |
| Location retention | cleanup job + close hooks |
| Notification outage | outbox/retry/failure state |
| Stale requests | TTL + expiry job |
| Synthetic metrics contamination | `is_synthetic` filtering |
| Cloud demo failure | local demo + backup/reseed |
| Geolocation blocked | HTTPS or locality/PIN fallback |
| Scope creep | surge/LLM after core MVP |

---

# 12. Product Roadmap

## MVP

- authentication;
- verified roles;
- hospital requests;
- bank inventory;
- atomic partial allocation;
- donor profiles;
- red-cell potential matching;
- donor pledges;
- privacy controls;
- notifications;
- cleanup;
- audit;
- basic dashboards.

## Advanced

- surge detector;
- admin surge workflow;
- richer metrics.

## Future Scope

- PostgreSQL;
- SSE/WebSockets;
- production identity verification;
- real blood-bank inventory integration;
- provider-grade SMS/FCM;
- per-unit inventory lifecycle;
- additional blood components only after correct medical/business requirements are established.

---

# Workflow Acceptance Requirement

The product shall implement the end-to-end workflow defined in [workflow.md](workflow.md).

A complete MVP demonstration must show:

```text
Hospital Request
   -> Bank Allocation
   -> Donor Fallback when required
   -> Donor Pledge
   -> Privacy-safe ETA
   -> Request Completion/Expiry
   -> Cleanup + Audit
```

External notification failure must not break this workflow.
