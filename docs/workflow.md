# System Workflow

## 1. Purpose

This document defines the operational workflow of the **Community Blood Donation Matching System** from login through request completion, including hospital, blood-bank, donor, admin, notification, cleanup, privacy, and surge-detection flows.

The workflow is intentionally designed so that:

- identity comes from the authenticated session;
- every state-changing request is authorized and CSRF-protected;
- bank and donor race conditions are resolved transactionally;
- donor private contact and precise location remain protected;
- external notification failure does not roll back emergency data;
- medical professionals remain the final authority.

---

# 2. End-to-End Emergency Workflow

```text
Verified Hospital User
        |
        v
Login
        |
        v
Create Emergency Request
        |
        v
Session Authentication
        |
        v
CSRF Validation
        |
        v
Role + Ownership Validation
        |
        v
Zod Input Validation
        |
        v
Duplicate Request Check
        |
        v
Create OPEN Request
        |
        v
Check Known Blood-Bank Inventory
        |
        v
Attempt Atomic Bank Allocation
        |
        v
Remaining Requirement?
      /              \
    No                Yes
    |                  |
    v                  v
Mark COVERED     Broadcast Remaining Need
                       |
                       v
                 Blood Banks Poll
                       |
                       v
                Bank Attempts Reserve
                       |
                       v
                 BEGIN IMMEDIATE
                       |
                       v
                Recalculate Remaining
                       |
                       v
                Reserve Available Units
                       |
                       v
                    COMMIT
                       |
                       v
               Remaining Requirement?
                  /          \
                No            Yes
                |              |
                v              v
             COVERED      Donor Fallback
                               |
                               v
                    Find Potential Donors
                               |
                               v
                    Queue Notifications
                               |
                               v
                    Notification Worker
                               |
                               v
                    Donor Receives Alert
                               |
                               v
                       Donor Pledges
                               |
                               v
                      BEGIN IMMEDIATE
                               |
                               v
                      Check Pledge Limit
                               |
                               v
                       Insert Pledge
                               |
                               v
                            COMMIT
                               |
                               v
                    Optional Location Share
                               |
                               v
                     Server Computes ETA Band
                               |
                               v
                    Hospital Sees Coarse Status
                               |
                               v
                Medical Screening / Verification
                               |
                               v
                 Complete / Cancel / Expire Request
                               |
                               v
                       Cleanup + Audit
```

---

# 3. Hospital Workflow

## 3.1 Login

```text
Hospital enters credentials
        |
        v
Generic credential validation
        |
        v
Account verified?
   /           \
 No             Yes
 |               |
 v               v
Reject       Create session
                 |
                 v
           Issue CSRF token
```

The login response must not reveal whether the email exists.

---

## 3.2 Create Emergency Request

Hospital submits:

```text
clientRequestId
bloodGroup
component = RED_CELLS
unitsNeeded
urgency
optional note
```

Server workflow:

```text
Authenticate
   |
Validate CSRF + Origin
   |
Require HOSPITAL role
   |
Check account verified
   |
Validate payload with Zod
   |
Check (hospital_id, client_request_id)
   |
Create request if not duplicate
   |
Set status = OPEN
   |
Set expires_at
   |
Write audit event
   |
Start sourcing workflow
```

---

## 3.3 Hospital Request Status

Hospital can see:

- request status;
- units requested;
- bank allocations;
- remaining requirement;
- pseudonymous donor pledge references;
- donor ETA band;
- donor distance band;
- notification/response status where appropriate.

Hospital cannot see:

- donor phone;
- donor email;
- exact donor latitude/longitude;
- internal reusable donor identity.

---

## 3.4 Hospital Cancel Workflow

```text
Hospital clicks Cancel
        |
        v
Ownership check
        |
        v
BEGIN IMMEDIATE
        |
        +--> release active bank allocations
        +--> restore inventory
        +--> close/expire active donor pledges
        +--> delete exact donor location sessions
        +--> mark request CANCELLED
        +--> write audit event
        |
        v
COMMIT
```

---

## 3.5 Hospital Complete Workflow

```text
Authorized completion
        |
        v
Validate ownership/state
        |
        v
Close active coordination records
        |
        v
Delete temporary location data
        |
        v
Set request COMPLETED
        |
        v
Write audit + metrics timestamps
```

Completion is a project workflow state and must not be described as clinical transfusion authorization.

---

# 4. Blood Bank Workflow

## 4.1 Inventory Update

```text
Bank logs in
    |
    v
Open Inventory
    |
    v
Update RED_CELLS stock
    |
    v
Role + bank ownership check
    |
    v
Zod validation
    |
    v
Update units_available
    |
    v
Set updated_at
    |
    v
Audit
```

A bank can update only its own inventory.

---

## 4.2 Incoming Request Workflow

Blood-bank dashboards poll authorized incoming broadcasts.

```text
GET authorized bank broadcasts
        |
        v
Show request summary
        |
        v
Bank chooses Reserve
```

The bank ID is taken from the authenticated session, never from request body input.

---

## 4.3 Atomic Allocation Workflow

```text
Bank clicks Reserve
        |
        v
Authenticate + CSRF
        |
        v
Verify request broadcast/access
        |
        v
BEGIN IMMEDIATE
        |
        v
Read OPEN request
        |
        v
SUM active allocations
        |
        v
remaining = units_needed - reserved
        |
        +--> if remaining <= 0 -> ALREADY_COVERED
        |
        v
Read bank inventory
        |
        v
quantity = min(remaining, available)
        |
        +--> if quantity <= 0 -> NO_STOCK
        |
        v
Conditional inventory decrement
        |
        v
Insert request allocation
        |
        v
Audit + queue notifications
        |
        v
COMMIT
```

This avoids check-then-act races.

---

## 4.4 Release Allocation Workflow

```text
Bank requests Release
        |
        v
Verify allocation belongs to bank
        |
        v
BEGIN IMMEDIATE
        |
        +--> mark allocation RELEASED
        +--> restore exact reserved units
        +--> audit
        |
        v
COMMIT
```

A release must never restore inventory outside the same transaction.

---

# 5. Donor Workflow

## 5.1 Registration/Profile

Donor provides:

- display name;
- blood group;
- private contact channel;
- city/locality/PIN;
- availability;
- optional self-reported last-donation/contact-window information.

Exact live coordinates are not required for permanent registration.

---

## 5.2 Donor Availability Workflow

```text
Donor sets AVAILABLE
        |
        v
availability_updated_at = now
```

If availability becomes too old:

```text
AVAILABLE -> UNKNOWN
```

based on configured freshness policy.

---

## 5.3 Potential Donor Matching

The matching service receives:

```text
component
recipient blood group
request location
```

The function structurally rejects unsupported components.

For the MVP:

```text
component must equal RED_CELLS
```

Candidate filtering:

```text
compatible registered blood group
        |
active account
        |
current availability
        |
contact-after policy satisfied
        |
not already pledged
        |
within approximate discovery area
```

The result is called a **potential donor**.

---

## 5.4 Donor Alert Workflow

```text
Potential donor identified
        |
        v
Create notification row = QUEUED
        |
        v
Core request transaction commits
        |
        v
Notification worker sends
        |
        +--> SENT / DELIVERED / ACKNOWLEDGED
        |
        +--> FAILED / retry
```

Provider failure never removes the emergency request.

---

## 5.5 Atomic Pledge Workflow

```text
Donor clicks Pledge
        |
        v
Authenticate donor
        |
        v
Verify donor received/relevant alert
        |
        v
BEGIN IMMEDIATE
        |
        v
Read OPEN request
        |
        v
Count active pledges
        |
        v
limit = units_needed + backup_slots
        |
        +--> if full -> SLOTS_FULL
        |
        v
Check duplicate donor pledge
        |
        v
Insert donor pledge
        |
        v
Generate request-specific public reference
        |
        v
Audit
        |
        v
COMMIT
```

No separate `donors_pledged` counter is required.

---

# 6. Donor Location and ETA Workflow

## 6.1 Start Sharing

Location sharing is available only after a valid pledge.

```text
Donor chooses Share ETA
        |
        v
Browser requests geolocation
        |
        +--> unavailable -> locality/PIN fallback
        |
        v
POST temporary coordinates
        |
        v
Store donor_location_session
        |
        v
Set expires_at
```

---

## 6.2 ETA Calculation

```text
Temporary donor position
        |
        v
Hospital/request location
        |
        v
Server-side distance calculation
        |
        v
Approximate travel model
        |
        v
ETA band + distance band
```

Hospital receives:

```text
pledge reference
ETA band
distance band
status
```

Hospital never receives exact donor coordinates.

---

## 6.3 Stop Sharing

```text
Donor clicks Stop
        |
        v
DELETE donor_location_session
        |
        v
Audit location-sharing stop
```

---

# 7. Notification Workflow

## 7.1 Queue

Notification rows are created as:

```text
QUEUED
```

inside the business transaction.

---

## 7.2 Worker

```text
Worker selects QUEUED jobs
        |
        v
Call provider
      /   \
 success   failure
   |          |
   v          v
 SENT       attempts + 1
              |
              +--> retry if under limit
              |
              +--> FAILED if max attempts reached
```

---

## 7.3 Metrics

Measure separately:

- queued timestamp;
- sent timestamp;
- delivered timestamp where supported;
- acknowledged timestamp.

Do not label dispatch latency as delivery latency.

---

# 8. Request Expiry Workflow

Every request has a TTL.

```text
Recurring expiry job
        |
        v
Find OPEN requests where expires_at <= now
        |
        v
BEGIN IMMEDIATE
        |
        +--> release active bank reservations
        +--> restore inventory
        +--> expire/cancel donor pledges
        +--> delete location sessions
        +--> mark request EXPIRED
        +--> audit
        |
        v
COMMIT
```

The expiry job also runs once at application startup.

---

# 9. Location Cleanup Workflow

```text
Recurring cleanup job
        |
        v
DELETE location sessions where:
    expires_at <= now
    OR request is COMPLETED
    OR request is CANCELLED
    OR request is EXPIRED
```

Cleanup also runs immediately when the request closes.

---

# 10. Admin Workflow

## 10.1 Verification

```text
New organization account
        |
        v
is_verified = false
        |
        v
Admin reviews
      /     \
 verify     reject
   |           |
   v           v
Enable      Keep blocked
domain use
```

---

## 10.2 Audit Review

Admin can inspect important events such as:

- login success/failure;
- account lock;
- request creation;
- allocation reserve/release;
- donor pledge;
- location-sharing start/stop;
- request expiry;
- notification failure;
- surge confirmation.

Sensitive values must be redacted.

---

# 11. Surge Detection Workflow

```text
New request/event data
        |
        v
Convert timestamp to configured local analysis timezone
        |
        v
Select baseline bucket
        |
        v
Compute observed demand
        |
        v
Poisson tail / configured anomaly logic
        |
        v
Calculate surge evidence/score
        |
        v
Unusual demand?
      /        \
    No          Yes
    |            |
    v            v
Normal       Create/Update Surge Event
                   |
                   v
            Generate recommendation
                   |
                   v
             Admin reviews
              /        \
           reject      confirm
             |            |
             v            v
          close        escalation action
```

The UI must say:

```text
Unusual demand surge detected
```

not:

```text
Disaster confirmed
```

---

# 12. Synthetic Demo Workflow

Synthetic data is explicitly flagged.

```text
Seed synthetic baseline
        |
        v
is_synthetic = 1
        |
        v
Inject demo requests
        |
        v
Run surge detector in demo mode
        |
        v
Display synthetic/demo label
```

Real Phase 5 metrics must query:

```text
is_synthetic = 0
```

---

# 13. CEP Mock Crisis Workflow

## Round 1 — Bank Concurrency

```text
Create one-unit request
        |
        v
Five bank clients reserve simultaneously
        |
        v
Immediate transaction arbitration
        |
        v
Exactly one unit reserved
```

---

## Round 2 — Donor Pledge Concurrency

```text
Create donor-fallback request
        |
        v
Five donors pledge simultaneously
        |
        v
Immediate transaction arbitration
        |
        v
Accepted pledge count <= configured limit
```

---

## Round 3 — Privacy

```text
Donor pledges
        |
        v
Starts location sharing
        |
        v
Hospital views pledge
        |
        v
Inspect browser network response
        |
        v
No phone / email / exact coordinates
```

---

## Round 4 — Cleanup

```text
Location session exists
        |
        v
Close request
        |
        v
Location row physically deleted
```

---

## Round 5 — Notification Failure

```text
Force provider failure
        |
        v
Request remains committed
        |
        v
Notification becomes retryable/FAILED
```

---

## Round 6 — Surge Demo

```text
Inject synthetic surge
        |
        v
Detector flags unusual demand
        |
        v
Admin confirmation required
```

---

# 14. Failure Recovery Workflow

## Database/Server Restart

```text
Application starts
        |
        v
Open database
        |
        v
Run schema/bootstrap checks
        |
        v
Run expired-request cleanup
        |
        v
Run expired-location cleanup
        |
        v
Resume notification worker
```

---

## Demo Recovery

Keep:

- seed script;
- database backup;
- race-test script;
- pledge-race-test script;
- health-check script.

The viva must not depend only on cloud availability or five volunteer phones.
