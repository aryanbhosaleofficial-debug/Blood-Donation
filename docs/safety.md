# Safety and Risk Controls

## Related Workflow

See [System Workflow](workflow.md) for the end-to-end operational flow connecting the modules, actors, transactions, notifications, cleanup jobs, and surge process.

## 1. Safety Position

The **Community Blood Donation Matching System** coordinates emergency sourcing. It must never be presented as a replacement for professional blood-bank or clinical processes.

The central safety principle is:

> Software may identify and notify potential sources. Medical professionals determine whether a donation or blood unit is suitable for use.

---

# 2. Medical Safety

## 2.1 Potential Donor vs Eligible Donor

The application may determine that a registered donor is a **potential donor** based on limited data.

It must not claim that a donor is:

- medically eligible;
- cleared to donate;
- transfusion compatible;
- safe for a particular patient.

Required medical processes remain outside the system.

---

## 2.2 Component Scope

The MVP donor-matching feature supports:

```text
RED_CELLS
```

only.

This avoids accidentally applying red-cell compatibility rules to plasma or other components.

---

## 2.3 Donor Arrival vs Blood Readiness

The UI must separate:

```text
Estimated donor arrival
```

from:

```text
Clinical readiness
```

A donor arriving at a facility does not imply that blood is immediately ready.

---

## 2.4 No Unsafe Travel Pressure

Display ETA as a band such as:

```text
15-20 min
```

Avoid precise countdowns or language that pressures donors to hurry.

---

## 2.5 Donation-History Filtering

Self-reported last-donation/contact-window information may be used to reduce unnecessary alerts.

It must be described as:

```text
contact filtering
```

not medical clearance.

Any interval used should be confirmed with the medical officer/blood bank during fieldwork before it becomes a project rule.

---

# 3. Privacy Safety

## 3.1 Data Minimization

Collect only data required for the prototype.

Do not collect additional medical history merely because it may be useful later.

---

## 3.2 Donor Contact Privacy

Hospital-facing responses must never include:

- donor phone number;
- donor email;
- exact home address.

The system mediates contact.

---

## 3.3 Exact Location Privacy

Precise donor position is:

- opt-in;
- temporary;
- server-side;
- request-bound;
- deleted after expiry/closure.

---

## 3.4 Triangulation Risk

Repeated ETA queries can reveal approximate position.

Controls:

- ETA only after donor pledge;
- request ownership validation;
- rate limits;
- coarse ETA bands;
- coarse distance bands;
- request-specific pseudonymous pledge ID.

---

## 3.5 Location Cleanup

A scheduled cleanup process must physically delete expired position rows.

Location data must also be deleted immediately when:

- donor stops sharing;
- request is completed;
- request is cancelled;
- request expires.

---

# 4. Cybersecurity Safety

## 4.1 Authentication

Use secure server-side sessions.

Session cookies:

```text
httpOnly
sameSite=lax
secure in production
```

---

## 4.2 CSRF

State-changing routes require CSRF protection.

This is mandatory because the browser automatically sends session cookies.

---

## 4.3 XSS

User-supplied text is rendered with DOM-safe text APIs.

Never use `innerHTML` for:

- donor name;
- hospital name;
- bank name;
- notes;
- locality;
- API error messages containing user input.

---

## 4.4 Password Safety

- bcrypt hashing;
- no plaintext storage;
- no public default credentials;
- lock repeated failed attempts;
- generic failure response.

---

## 4.5 Authorization and IDOR

Every route checks both:

1. role;
2. access to the specific resource.

Sequential IDs are acceptable only when authorization is correct.

---

# 5. Transaction and Concurrency Safety

## 5.1 Immediate Transactions

Operations that perform read-decide-write under concurrency must use an immediate SQLite transaction.

This includes:

- bank reservation;
- donor pledge slot claim;
- allocation release;
- expiry cleanup that restores stock.

---

## 5.2 Inventory Safety

Inventory decrement and allocation creation occur in the same transaction.

Inventory must never become negative.

---

## 5.3 Reservation Release Safety

If a bank releases reserved units:

- allocation state changes;
- exact units are restored;
- both operations commit together.

---

## 5.4 Duplicate Protection

Use database uniqueness for:

- `(hospital_id, client_request_id)`;
- `(request_id, donor_id)`;
- `(request_id, bank_id)` where appropriate;
- request-specific pledge public references.

---

# 6. Notification Safety

## 6.1 External Provider Isolation

The emergency request transaction must not call Telegram/email/FCM directly.

External network calls happen after commit.

---

## 6.2 Failure Handling

Provider failure:

- does not delete request;
- does not roll back allocation;
- creates/updates failure status;
- may retry;
- is visible to administrator.

---

## 6.3 Metrics Honesty

Use separate terms:

- queued;
- sent;
- delivered;
- acknowledged.

Do not report delivery if only sending is known.

---

# 7. Operational Safety

## 7.1 Request Expiry

Every open request has a TTL.

Expired requests are cleaned to prevent:

- endless dashboard alerts;
- stale location sessions;
- polluted surge statistics;
- stale reserved inventory.

---

## 7.2 Inventory Freshness

The UI shows when inventory was last updated.

The project must clearly state:

> Database inventory reflects the last recorded state and may differ from physical stock.

---

## 7.3 Single Database Backup

Before demonstration:

- back up SQLite database;
- retain seed script;
- retain second repository copy.

---

## 7.4 Cloud Deployment Limitations

Do not rely on:

- ephemeral free-tier storage;
- sleeping services;
- non-persistent SQLite files

for the only viva demonstration.

---

# 8. Surge/AI Safety

## 8.1 Correct Framing

The statistical layer detects unusual demand.

It does not diagnose the cause.

---

## 8.2 Synthetic Data

Synthetic baseline/demo data must be clearly marked.

Synthetic success does not prove real-world predictive accuracy.

---

## 8.3 Human-in-the-Loop

High-level escalation requires an administrator.

The system should present:

- score;
- evidence;
- recommendation;
- confidence/limitations.

---

## 8.4 LLM Boundary

If an LLM is later added, it may:

- summarize structured anomaly data;
- draft an admin brief;
- draft an escalation notice.

It must not:

- decide compatibility;
- choose a medically eligible donor;
- change inventory;
- automatically initiate high-level emergency redistribution.

Personal/sensitive data should not be sent to an external LLM unless a later project requirement explicitly addresses privacy and authorization.

---

# 9. Demo Safety Checklist

Before the viva:

- [ ] Test login/logout.
- [ ] Test CSRF rejection.
- [ ] Test role denial.
- [ ] Test ownership/IDOR protection.
- [ ] Test XSS payload renders as text.
- [ ] Test simultaneous bank allocation.
- [ ] Test simultaneous donor pledges.
- [ ] Inspect hospital network response for donor private data.
- [ ] Start donor location sharing.
- [ ] Close request and confirm location row deletion.
- [ ] Simulate notification provider failure.
- [ ] Verify request still exists.
- [ ] Confirm synthetic rows are excluded from real metrics.
- [ ] Confirm surge UI says "unusual demand" rather than "disaster confirmed".
- [ ] Back up database.
- [ ] Verify race-test fallback script.

---

# 10. Safety Limitations to State in the Report

The following remain external/system-boundary limitations:

1. Physical inventory may differ from recorded inventory.
2. Medical professionals determine donor suitability.
3. External notification delivery cannot be guaranteed.
4. Approximate ETA is not road-navigation quality.
5. Donor turnout is not guaranteed.
6. SQLite is a prototype database, not a high-availability production platform.
7. Surge detection is demonstrated using synthetic data unless real historical data becomes available.
8. SMS/provider/legal infrastructure is external to the prototype.
