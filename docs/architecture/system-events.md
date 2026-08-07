# FeezypayERP — System Event Catalogue

> **Phase:** 0.5 — Architecture (design-only)  
> **Created:** 2026-08-06  
> **Status:** Canonical event contracts — **not yet implemented in application code**  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`rbac.md`](rbac.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md) · [`notification-engine.md`](notification-engine.md) · [`ai-architecture.md`](ai-architecture.md)
> **Rule:** Engines communicate through **events** (and explicit commands). They must not call each other’s internal write logic or share mutable in-process state.

---

## 1. Why events

Tight coupling fails when:

- Fee code imports Attendance tables to invent fines
- Notification code reaches into Invoice rows to build WhatsApp copy
- Document generation blocks the Assessment save transaction for minutes
- AI writes admissions inside a chat handler

**Events** announce that a fact changed in the **owning engine**. **Consumers** react in their own boundary (sync handler or async job). **Commands** are the only way to request a write in another engine (`enrollment.create_placement`), usually triggered after an event or user action.

```text
  Producer engine                Event bus / outbox              Consumer engines
  (owns the write)     ──emit──▶  (sync bus or queue)  ──▶  (own their writes)
```

Until an event bus exists, treat this catalogue as the **API contract** for future adapters (Postgres `LISTEN`, queue, or in-process mediator). Naming and payloads should not churn casually.

---

## 2. Conventions

### 2.1 Naming

```text
{domain}.{entity}.{past_tense_verb}

Examples:
  enrollment.student.admitted
  workforce.teacher.joined
  assessment.exam.published
  calendar.academic_year.closed
```

- Prefer **past tense** (something happened).  
- `domain` aligns to engine concern (not always E-number).  
- Version breaking changes as `…v2` only if unavoidable; prefer additive payload fields.

### 2.2 Envelope (every event)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_id` | uuid | yes | Idempotency key |
| `event_name` | string | yes | Catalogue name |
| `event_version` | int | yes | Start at `1` |
| `occurred_at` | ISO-8601 | yes | Producer clock |
| `school_id` | uuid \| null | usually | Null only for platform-global events |
| `actor` | object | yes | `{ auth_user_id?, person_id?, type: user\|system\|ai }` |
| `correlation_id` | uuid | yes | Ties request/wizard/job |
| `causation_id` | uuid \| null | no | Prior `event_id` if chained |
| `payload` | object | yes | **Ids + small enums only** — no denormalized PII dumps |

### 2.3 Payload rules

1. Carry **identifiers**, not copies of `full_name`, marks matrices, or PDF bytes.  
2. Consumers **load** current state from owning engines (or read models).  
3. Include enums needed for routing (`status`, `channel`) when they avoid an extra round-trip.  
4. Never put secrets (provider keys, raw Aadhaar) in payloads.

### 2.4 Synchronous vs asynchronous

| Mode | Meaning | Use when |
|------|---------|----------|
| **Sync** | Handler runs in same request/unit-of-work (or immediate in-process mediator) before producer returns success | Invariants must hold before UI continues; small fan-out; AuthZ cache invalidate |
| **Async** | Enqueued; processed later with retries | Email/WhatsApp, PDF render, analytics, AI, large fan-out, external providers |

**Default:** domain fan-out that is not correctness-critical → **Async**. Ledger credit on `payment.succeeded` may be **Sync** within a transactional outbox pattern so users see balance immediately—*still* via event handler in E15, not E16 writing fee tables.

### 2.5 Delivery guarantees (target)

| Guarantee | Target |
|-----------|--------|
| At-least-once | Yes (consumers **idempotent** on `event_id`) |
| Ordering | Per `school_id` + aggregate id where required (e.g. same `invoice_id`) |
| Durability | Outbox table in producer DB before commit (future) |

### 2.6 Command vs event

| Kind | Example | Who executes write |
|------|---------|-------------------|
| **Event** | `enrollment.student.admitted` | Already done by E06 |
| **Command** | `fee.generate_invoices_for_placement` | E15 |
| **Accepted suggestion** | `ai.suggestion.accepted` (event) → command to owner | Owning engine |

---

## 3. Catalogue index

| # | Event name | Producer | Sync/Async | Maturity |
|---|------------|----------|------------|----------|
| [1](#1-tenantschoolcreated) | `tenant.school.created` | E01 | Sync | Planned |
| [2](#2-tenantonboardingcompleted) | `tenant.onboarding.completed` | E01 | Sync | Planned |
| [3](#3-tenantschoolsuspended) | `tenant.school.suspended` | E01 | Sync | Planned |
| [4](#4-accessusersignedup) | `access.user.signed_up` | E02 | Sync | Planned |
| [5](#5-accessuserauthenticated) | `access.user.authenticated` | E02 | Async | Planned |
| [6](#6-accesspasswordresetrequested) | `access.password_reset.requested` | E02 | Async | Partial today* |
| [7](#7-identityauthbound) | `identity.person.auth_bound` | E04 | Sync | Planned |
| [8](#8-identityprofilecompleted) | `identity.person.profile_completed` | E04 | Sync | Planned |
| [9](#9-identityrolegranted) | `identity.person.role_granted` | E04 | Sync | Planned |
| [10](#10-workforceteacherinvited) | `workforce.teacher.invited` | E05 | Async | Planned |
| [11](#11-workforceteacherjoined) | `workforce.teacher.joined` | E05 | Sync | Planned |
| [12](#12-workforceteacherended) | `workforce.teacher.ended` | E05 | Sync | Planned |
| [13](#13-workforcedepartmentchanged) | `workforce.employment.updated` | E05 | Async | Planned |
| [14](#14-enrollmentstudentadmitted) | `enrollment.student.admitted` | E06 | Sync | Planned |
| [15](#15-enrollmentstudentwithdrawn) | `enrollment.student.withdrawn` | E06 | Sync | Planned |
| [16](#16-enrollmentstudenttransferred) | `enrollment.student.transferred` | E06 | Sync | Planned |
| [17](#17-enrollmentplacementcreated) | `enrollment.placement.created` | E06 | Sync | Planned |
| [18](#18-enrollmentplacementcompleted) | `enrollment.placement.completed` | E06 | Async | Planned |
| [19](#19-enrollmentparentlinked) | `enrollment.parent.linked` | E06 | Async | Planned |
| [20](#20-structureclasscreated) | `structure.class.changed` | E09 | Async | Planned |
| [21](#21-structuresectionchanged) | `structure.section.changed` | E09 | Async | Planned |
| [22](#22-structurepromotionrequested) | `structure.promotion.requested` | E09 | Async | Planned |
| [23](#23-configcatalogupdated) | `config.catalog.updated` | E07 | Async | Planned |
| [24](#24-calendaryearactivated) | `calendar.academic_year.activated` | E08 | Sync | Planned |
| [25](#25-calendaryearclosed) | `calendar.academic_year.closed` | E08 | Sync | Planned |
| [26](#26-calendartermchanged) | `calendar.term.changed` | E08 | Async | Planned |
| [27](#27-calendarholidaychanged) | `calendar.holiday.changed` | E08 | Async | Planned |
| [28](#28-timetablepublished) | `timetable.grid.published` | E10 | Async | Planned |
| [29](#29-lessonplanshared) | `timetable.lesson_plan.shared` | E10 | Async | Planned |
| [30](#30-assessmentcreated) | `assessment.exam.created` | E11 | Async | Planned |
| [31](#31-assessmentupdated) | `assessment.exam.updated` | E11 | Async | Planned |
| [32](#32-assessmentpublished) | `assessment.exam.published` | E11 | Async | Planned |
| [33](#33-assessmentresultspublished) | `assessment.results.published` | E11 | Async | **Wired** (§58) |
| [34](#34-attendancemarked) | `attendance.record.marked` | E12 | Async | **Wired** (§58) |
| [35](#35-attendancethresholdbreached) | `attendance.threshold.breached` | E12 | Async | Planned |
| [36](#36-conductincidentrecorded) | `conduct.incident.recorded` | E13 | Async | **Wired** (§58) |
| [37](#37-healthupdated) | `health.profile.updated` | E14 | Async | Planned |
| [38](#38-feeinvoicecreated) | `fee.invoice.created` | E15 | Async | Planned |
| [39](#39-feeinvoiceoverdue) | `fee.invoice.overdue` | E15 | Async | Planned |
| [40](#40-feeinvoicevoided) | `fee.invoice.voided` | E15 | Sync | Planned |
| [41](#41-feeledgerposted) | `fee.ledger.posted` | E15 | Async | Planned |
| [42](#42-paymentsucceeded) | `payment.transaction.succeeded` | E16 | Sync† | Planned |
| [43](#43-paymentfailed) | `payment.transaction.failed` | E16 | Async | Planned |
| [44](#44-paymentrefunded) | `payment.transaction.refunded` | E16 | Sync† | Planned |
| [45](#45-eventscheduled) | `engagement.event.scheduled` | E17 | Async | Planned |
| [46](#46-eventpublished) | `engagement.event.published` | E17 | Async | **Wired** (§58) |
| [47](#47-eventcompleted) | `engagement.event.completed` | E17 | Async | Planned |
| [48](#48-eventcancelled) | `engagement.event.cancelled` | E17 | Async | Planned |
| [49](#49-competitionpublished) | `engagement.competition.published` | E17 | Async | Planned |
| [50](#50-announcementpublished) | `communication.announcement.published` | E18 | Async | Planned |
| [51](#51-messageready) | `communication.message.ready_for_delivery` | E18 | Async | Planned |
| [52](#52-notificationsent) | `notification.delivery.sent` | E19 | Async | Planned |
| [53](#53-notificationdelivered) | `notification.delivery.delivered` | E19 | Async | Planned |
| [54](#54-notificationbounced) | `notification.delivery.bounced` | E19 | Async | Planned |
| [55](#55-documentissued) | `document.artifact.issued` | E20 | Async | **Wired** (§58) |
| [56](#56-reportcardgenerated) | `document.report_card.generated` | E20 | Async | Planned |
| [H1](#h1-homeworkassigned) | `homework.assigned` | Homework | Async | **Wired** (§58) |
| [C1](#c1-curriculumpublished) | `curriculum.published` | E30 | Async | DESIGNED |
| [C2](#c2-curriculumcloned) | `curriculum.cloned` | E30 | Async | DESIGNED |
| [C3](#c3-curriculumtopiccompleted) | `curriculum.topic.completed` | E30 | Async | DESIGNED |
| [AF1](#af1-assessmentframeworkpublished) | `assessment_framework.published` | E31 | Async | DESIGNED |
| [AF2](#af2-assessmentframeworkcloned) | `assessment_framework.cloned` | E31 | Async | DESIGNED |
| [AR1](#ar1-assessmentrecordcreated) | `assessment_recording.record.created` | E32 | Async | DESIGNED |
| [AR2](#ar2-assessmentrecordlocked) | `assessment_recording.record.locked` | E32 | Async | DESIGNED |
| [57](#57-reportrequested) | `reporting.job.requested` | E21 | Async | Planned |
| [58](#58-reportgenerated) | `reporting.job.completed` | E21 | Async | Planned |
| [59](#59-analyticsbatchcompleted) | `analytics.batch.completed` | E22 | Async | Planned |
| [60](#60-aisuggestionproposed) | `ai.suggestion.proposed` | E23 | Async | Planned |
| [61](#61-aisuggestionaccepted) | `ai.suggestion.accepted` | E23 | Sync | Planned |
| [62](#62-marketplacepublished) | `marketplace.listing.published` | E24 | Async | Planned |
| [63](#63-onboardingstepcompleted) | `onboarding.step.completed` | E25 | Sync | Planned |
| [64](#64-ingestioncommitted) | `ingestion.job.committed` | E26 | Async | Planned |
| [65](#65-ingestionfailed) | `ingestion.job.failed` | E26 | Async | Planned |
| [66](#66-mediauploaded) | `media.asset.uploaded` | E27 | Async | Planned |
| [67](#67-auditrecorded) | `audit.entry.recorded` | E28 | Async | Planned |

\*Today password emails may go through Supabase Auth mailer; still model the event for app-owned flows.  
†Sync = E15 ledger handler should run reliably before user-visible “paid” confirmation (outbox + sync drain acceptable).

---

## 4. Event definitions

Each entry: **Producer** · **Consumers** · **Payload** · **Triggered when** · **Mode**.

---

### 1. `tenant.school.created`

| | |
|--|--|
| **Producer** | E01 Tenancy |
| **Consumers** | E25 (start wizard), E28 Audit, E22 Analytics |
| **Payload** | `{ school_id }` |
| **Triggered when** | New School row provisioned (signup create-school path) |
| **Mode** | **Sync** — wizard/resume must see tenant immediately |

---

### 2. `tenant.onboarding.completed`

| | |
|--|--|
| **Producer** | E01 (after E25 completion command) |
| **Consumers** | E19/E18 (welcome), E22, E28, dashboard gates |
| **Payload** | `{ school_id, completed_at }` |
| **Triggered when** | `onboarding_status` → `completed` |
| **Mode** | **Sync** for gating; welcome message **Async** |

---

### 3. `tenant.school.suspended`

| | |
|--|--|
| **Producer** | E01 |
| **Consumers** | E02 (session revoke policy), E03, E19, E16 (block payouts) |
| **Payload** | `{ school_id, reason_code }` |
| **Triggered when** | Platform/admin suspends tenant |
| **Mode** | **Sync** |

---

### 4. `access.user.signed_up`

| | |
|--|--|
| **Producer** | E02 |
| **Consumers** | E01 (if create-school), E28 |
| **Payload** | `{ auth_user_id, intent: create_school \| accept_invite }` |
| **Triggered when** | Auth user created |
| **Mode** | **Sync** (drives F11 split) |

---

### 5. `access.user.authenticated`

| | |
|--|--|
| **Producer** | E02 |
| **Consumers** | E03 (session context), E22, E28 |
| **Payload** | `{ auth_user_id, method }` |
| **Triggered when** | Successful login / token refresh (sample rate OK) |
| **Mode** | **Async** |

---

### 6. `access.password_reset.requested`

| | |
|--|--|
| **Producer** | E02 (or E05 triggering reset for staff email) |
| **Consumers** | E19 (if app-owned mail), E28 |
| **Payload** | `{ email_hash_or_ref, purpose: recovery \| invite_setup }` |
| **Triggered when** | Forgot-password or staff save reset attempt |
| **Mode** | **Async** |

---

### 7. `identity.person.auth_bound`

| | |
|--|--|
| **Producer** | E04 |
| **Consumers** | E03, E05 (`invited`→`active` candidate), E28 |
| **Payload** | `{ person_id, auth_user_id }` |
| **Triggered when** | `persons.auth_user_id` set |
| **Mode** | **Sync** |

---

### 8. `identity.person.profile_completed`

| | |
|--|--|
| **Producer** | E04 |
| **Consumers** | E05, E03, E24 (eligible to list) |
| **Payload** | `{ person_id, profile_completed_at }` |
| **Triggered when** | First-login wizard sets `profile_completed_at` |
| **Mode** | **Sync** |

---

### 9. `identity.person.role_granted`

| | |
|--|--|
| **Producer** | E04 |
| **Consumers** | E03 |
| **Payload** | `{ person_id, role }` |
| **Triggered when** | `person_roles` insert |
| **Mode** | **Sync** |

---

### 10. `workforce.teacher.invited`

| | |
|--|--|
| **Producer** | E05 |
| **Consumers** | E02 (invite credential), E19, E18, E28 |
| **Payload** | `{ employment_id, school_id, teacher_profile_id, person_id }` |
| **Triggered when** | Employment `status=invited` |
| **Mode** | **Async** |

---

### 11. `workforce.teacher.joined`

| | |
|--|--|
| **Producer** | E05 |
| **Consumers** | E03, E10 (eligible for slots), E22, E28 · *Human name: Teacher Joined* |
| **Payload** | `{ employment_id, school_id, teacher_profile_id, person_id }` |
| **Triggered when** | Employment becomes `active` (hire or invite accept) |
| **Mode** | **Sync** |

---

### 12. `workforce.teacher.ended`

| | |
|--|--|
| **Producer** | E05 |
| **Consumers** | E03, E10 (drop future slots policy), E22, E28 |
| **Payload** | `{ employment_id, school_id, ended_on }` |
| **Triggered when** | Employment `ended` |
| **Mode** | **Sync** |

---

### 13. `workforce.employment.updated`

| | |
|--|--|
| **Producer** | E05 |
| **Consumers** | E10 (revalidate assignments), E03 (HOD flag), E22 |
| **Payload** | `{ employment_id, changed_fields[] }` |
| **Triggered when** | Designation/department/subjects/HOD change |
| **Mode** | **Async** |

---

### 14. `enrollment.student.admitted`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E03, E15 (fee plans), E12, E18/E19 welcome, E22, E28 · *Student Admitted* |
| **Payload** | `{ admission_id, school_id, student_profile_id, person_id, admission_number }` |
| **Triggered when** | Active StudentAdmission created |
| **Mode** | **Sync** (fee/authz may need immediate membership) |

---

### 15. `enrollment.student.withdrawn`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E15, E12, E10, E03, E22 |
| **Payload** | `{ admission_id, school_id, exited_on }` |
| **Triggered when** | Admission → `withdrawn` |
| **Mode** | **Sync** |

---

### 16. `enrollment.student.transferred`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E15, E20 (TC), E03, E22 |
| **Payload** | `{ from_admission_id, to_admission_id?, school_id, to_school_id? }` |
| **Triggered when** | Admission → `transferred` (and/or new admission elsewhere) |
| **Mode** | **Sync** |

---

### 17. `enrollment.placement.created`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E12, E11, E15, E10, E22 |
| **Payload** | `{ placement_id, admission_id, academic_year_id, class_id, section_id }` |
| **Triggered when** | StudentPlacement (academic year row) created active |
| **Mode** | **Sync** |

---

### 18. `enrollment.placement.completed`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E09 (promotion cohort), E11, E22 |
| **Payload** | `{ placement_id, promotion_status? }` |
| **Triggered when** | Placement completed/left for year |
| **Mode** | **Async** |

---

### 19. `enrollment.parent.linked`

| | |
|--|--|
| **Producer** | E06 |
| **Consumers** | E03, E18 (consent prompts), E15 (payer), E28 |
| **Payload** | `{ student_profile_id, parent_profile_id, relationship, is_primary }` |
| **Triggered when** | StudentParentLink upsert |
| **Mode** | **Async** |

---

### 20. `structure.class.changed`

| | |
|--|--|
| **Producer** | E09 |
| **Consumers** | E07 (class_subjects), E15, E10, E22 |
| **Payload** | `{ class_id, academic_year_id, change: created\|updated\|archived }` |
| **Triggered when** | Class CRUD |
| **Mode** | **Async** |

---

### 21. `structure.section.changed`

| | |
|--|--|
| **Producer** | E09 |
| **Consumers** | E10, E06, E12, E22 |
| **Payload** | `{ section_id, class_id, class_teacher_employment_id? }` |
| **Triggered when** | Section CRUD or class teacher assign |
| **Mode** | **Async** |

---

### 22. `structure.promotion.requested`

| | |
|--|--|
| **Producer** | E09 (or admin command via E09) |
| **Consumers** | **E06** (must create placements — command-like consumer) |
| **Payload** | `{ school_id, from_year_id, to_year_id, rule_id, cohort_filter }` |
| **Triggered when** | Promotion batch started |
| **Mode** | **Async** (batch) |

---

### 23. `config.catalog.updated`

| | |
|--|--|
| **Producer** | E07 |
| **Consumers** | E10, E11, E05 (subject validation caches), E22 |
| **Payload** | `{ entity: subject\|house\|club\|grading_scale\|…, entity_id, change }` |
| **Triggered when** | Catalog write |
| **Mode** | **Async** |

---

### 24. `calendar.academic_year.activated`

| | |
|--|--|
| **Producer** | E08 |
| **Consumers** | E09, E10, E11, E15, E25, E22 |
| **Payload** | `{ academic_year_id, school_id }` |
| **Triggered when** | Year marked `is_active` |
| **Mode** | **Sync** |

---

### 25. `calendar.academic_year.closed`

| | |
|--|--|
| **Producer** | E08 |
| **Consumers** | E06 (complete placements), E11 (lock results), E15 (close plans), E10, E20, E22 · *Academic Year Closed* |
| **Payload** | `{ academic_year_id, school_id, closed_at }` |
| **Triggered when** | Year closed / deactivated for rollover |
| **Mode** | **Sync** (orchestration) + Async side effects |

---

### 26. `calendar.term.changed`

| | |
|--|--|
| **Producer** | E08 |
| **Consumers** | E11, E20, E22 |
| **Payload** | `{ term_id, academic_year_id, change }` |
| **Triggered when** | Term create/update |
| **Mode** | **Async** |

---

### 27. `calendar.holiday.changed`

| | |
|--|--|
| **Producer** | E08 |
| **Consumers** | E12 (no attendance expected), E10, E22 |
| **Payload** | `{ holiday_id, school_id, date, change }` |
| **Triggered when** | Holiday schedule mutates |
| **Mode** | **Async** |

---

### 28. `timetable.grid.published`

| | |
|--|--|
| **Producer** | E10 |
| **Consumers** | E12, E18/E19 (notify teachers), E22 |
| **Payload** | `{ academic_year_id, school_id, version? }` |
| **Triggered when** | Timetable published for use |
| **Mode** | **Async** |

---

### 29. `timetable.lesson_plan.shared`

| | |
|--|--|
| **Producer** | E10 |
| **Consumers** | E18, E22, E23 |
| **Payload** | `{ lesson_plan_id, employment_id, section_id }` |
| **Triggered when** | LessonPlan shared with peers/students |
| **Mode** | **Async** |

---

### 30. `assessment.exam.created`

| | |
|--|--|
| **Producer** | E11 |
| **Consumers** | E20, E22 · *Assessment Created* |
| **Payload** | `{ assessment_id, academic_year_id, term_id? }` |
| **Triggered when** | Exam definition inserted |
| **Mode** | **Async** |

---

### 31. `assessment.exam.updated`

| | |
|--|--|
| **Producer** | E11 |
| **Consumers** | E20, E10 (schedule conflicts), E22 |
| **Payload** | `{ assessment_id, changed_fields[] }` |
| **Triggered when** | Definition/schedule edited before publish |
| **Mode** | **Async** |

---

### 32. `assessment.exam.published`

| | |
|--|--|
| **Producer** | E11 |
| **Consumers** | E18/E19 (notify), E12, E22 · *Exam Published* |
| **Payload** | `{ assessment_id, academic_year_id }` |
| **Triggered when** | Assessment lifecycle → published for students/teachers |
| **Mode** | **Async** |

---

### 33. `assessment.results.published`

| | |
|--|--|
| **Producer** | E11 |
| **Consumers** | E20 (report cards), E18/E19, E22, E23, E15 (conditional scholarships) |
| **Payload** | `{ assessment_id, scope: section_id\|class_id\|school_id }` |
| **Triggered when** | Results locked & visible |
| **Mode** | **Async** |

---

### 34. `attendance.record.marked`

| | |
|--|--|
| **Producer** | E12 |
| **Consumers** | E22, E23; optionally E18 for same-day parent digest · *Attendance Marked* |
| **Payload** | `{ record_id, placement_id, date, status, slot_id? }` |
| **Triggered when** | AttendanceRecord written |
| **Mode** | **Async** |

---

### 35. `attendance.threshold.breached`

| | |
|--|--|
| **Producer** | E12 |
| **Consumers** | **E15** (fine command), E18/E19, E13 (optional), E22 |
| **Payload** | `{ placement_id, admission_id, metric, window, value }` |
| **Triggered when** | Absence/late policy threshold crossed |
| **Mode** | **Async** |

---

### 36. `conduct.incident.recorded`

| | |
|--|--|
| **Producer** | E13 |
| **Consumers** | E18/E19 (controlled), E20 (TC remarks), E22, E03 |
| **Payload** | `{ incident_id, student_profile_id, severity }` |
| **Triggered when** | ConductIncident created |
| **Mode** | **Async** |

---

### 37. `health.profile.updated`

| | |
|--|--|
| **Producer** | E14 |
| **Consumers** | E17 (trip clearance), E03 (ACL refresh), E28 |
| **Payload** | `{ student_profile_id, change_type }` |
| **Triggered when** | Medical notes/incidents change |
| **Mode** | **Async** |

---

### 38. `fee.invoice.created`

| | |
|--|--|
| **Producer** | E15 |
| **Consumers** | E18/E19, E16 (payment intent prep), E22, E28 |
| **Payload** | `{ invoice_id, admission_id, amount, currency, due_on }` |
| **Triggered when** | Invoice issued |
| **Mode** | **Async** |

---

### 39. `fee.invoice.overdue`

| | |
|--|--|
| **Producer** | E15 (scheduler) |
| **Consumers** | E18/E19, E22, E23 |
| **Payload** | `{ invoice_id, admission_id, days_overdue }` |
| **Triggered when** | Due date passed unpaid |
| **Mode** | **Async** |

---

### 40. `fee.invoice.voided`

| | |
|--|--|
| **Producer** | E15 |
| **Consumers** | E16 (cancel intents), E18, E22, E28 |
| **Payload** | `{ invoice_id, reason_code }` |
| **Triggered when** | Invoice voided |
| **Mode** | **Sync** |

---

### 41. `fee.ledger.posted`

| | |
|--|--|
| **Producer** | E15 |
| **Consumers** | E22, E20 (receipts), E28 |
| **Payload** | `{ ledger_entry_id, admission_id, entry_type, amount, invoice_id?, payment_id? }` |
| **Triggered when** | LedgerEntry appended |
| **Mode** | **Async** |

---

### 42. `payment.transaction.succeeded`

| | |
|--|--|
| **Producer** | E16 |
| **Consumers** | **E15** (mandatory ledger credit), E20 receipt, E19, E28 |
| **Payload** | `{ payment_id, invoice_id, amount, provider_ref }` |
| **Triggered when** | Provider confirms success / webhook |
| **Mode** | **Sync†** for E15 credit; notify Async |

---

### 43. `payment.transaction.failed`

| | |
|--|--|
| **Producer** | E16 |
| **Consumers** | E18/E19, E22, E28 |
| **Payload** | `{ payment_id, invoice_id, failure_code }` |
| **Triggered when** | Provider failure |
| **Mode** | **Async** |

---

### 44. `payment.transaction.refunded`

| | |
|--|--|
| **Producer** | E16 |
| **Consumers** | **E15** (compensating ledger), E20, E28 |
| **Payload** | `{ payment_id, invoice_id, refund_amount, provider_ref }` |
| **Triggered when** | Refund settled |
| **Mode** | **Sync†** for ledger |

---

### 45. `engagement.event.scheduled`

| | |
|--|--|
| **Producer** | E17 |
| **Consumers** | E08 (conflict check consumers), E18, E22 |
| **Payload** | `{ event_id, school_id, starts_at, ends_at }` |
| **Triggered when** | CalendarEvent enters scheduled |
| **Mode** | **Async** |

---

### 46. `engagement.event.published`

| | |
|--|--|
| **Producer** | E17 |
| **Consumers** | E18/E19 (announce), E22 |
| **Payload** | `{ event_id, audience_ref }` |
| **Triggered when** | Event published to audience |
| **Mode** | **Async** |

---

### 47. `engagement.event.completed`

| | |
|--|--|
| **Producer** | E17 |
| **Consumers** | E22, E20 (certificates), E23 · *Event Completed* |
| **Payload** | `{ event_id, completed_at }` |
| **Triggered when** | Event marked completed |
| **Mode** | **Async** |

---

### 48. `engagement.event.cancelled`

| | |
|--|--|
| **Producer** | E17 |
| **Consumers** | E18/E19, E15 (refund tickets), E22 |
| **Payload** | `{ event_id, reason_code }` |
| **Triggered when** | Event cancelled |
| **Mode** | **Async** |

---

### 49. `engagement.competition.published`

| | |
|--|--|
| **Producer** | E17 |
| **Consumers** | E18/E19, E07 (house points later), E22 |
| **Payload** | `{ competition_id, school_id }` |
| **Triggered when** | Competition opens |
| **Mode** | **Async** |

---

### 50. `communication.announcement.published`

| | |
|--|--|
| **Producer** | E18 |
| **Consumers** | E19 (delivery fan-out), E22 |
| **Payload** | `{ announcement_id, channel_targets[] }` |
| **Triggered when** | Announcement published |
| **Mode** | **Async** |

---

### 51. `communication.message.ready_for_delivery`

| | |
|--|--|
| **Producer** | E18 |
| **Consumers** | **E19** (only pipe) |
| **Payload** | `{ message_id, channel, recipient_ref, template_id? }` |
| **Triggered when** | Rendered message ready (consent already checked) |
| **Mode** | **Async** |

---

### 52. `notification.delivery.sent`

| | |
|--|--|
| **Producer** | E19 |
| **Consumers** | E28, E22 · *Notification Sent* (accepted by provider) |
| **Payload** | `{ notification_id, message_id, channel, provider_ref }` |
| **Triggered when** | Provider accept |
| **Mode** | **Async** |

---

### 53. `notification.delivery.delivered`

| | |
|--|--|
| **Producer** | E19 |
| **Consumers** | E18 (message state), E28 |
| **Payload** | `{ notification_id, delivered_at }` |
| **Triggered when** | Delivery receipt |
| **Mode** | **Async** |

---

### 54. `notification.delivery.bounced`

| | |
|--|--|
| **Producer** | E19 |
| **Consumers** | E18 (consent/address hygiene), E04 (optional flag), E28 |
| **Payload** | `{ notification_id, bounce_code }` |
| **Triggered when** | Bounce/complaint |
| **Mode** | **Async** |

---

### 55. `document.artifact.issued`

| | |
|--|--|
| **Producer** | E20 |
| **Consumers** | E19, E28, E22 · *Report/Document Generated* family |
| **Payload** | `{ document_id, template_id, subject_person_id, kind }` |
| **Triggered when** | IssuedDocument created |
| **Mode** | **Async** |

---

### 56. `document.report_card.generated`

| | |
|--|--|
| **Producer** | E20 |
| **Consumers** | E18/E19 (notify parents), E22 · *Report Generated* |
| **Payload** | `{ document_id, placement_id, term_id?, academic_year_id }` |
| **Triggered when** | ReportCard artifact ready |
| **Mode** | **Async** |

---

### C1. `curriculum.published`

| | |
|--|--|
| **Producer** | E30 Curriculum |
| **Consumers** | E28 Audit; future E11/E23 (bind assessments / AI) |
| **Payload** | `{ curriculum_id, curriculum_version_id, version }` |
| **Triggered when** | Pack published / version bumped |
| **Mode** | **Async** — DESIGNED (emit stub deferred) |

---

### C2. `curriculum.cloned`

| | |
|--|--|
| **Producer** | E30 |
| **Consumers** | E28 |
| **Payload** | `{ source_curriculum_id, new_curriculum_id, target_academic_year_id }` |
| **Triggered when** | Pack cloned to another year/class |
| **Mode** | **Async** — DESIGNED |

---

### C3. `curriculum.topic.completed`

| | |
|--|--|
| **Producer** | E30 |
| **Consumers** | E22 Analytics (future); E28 |
| **Payload** | `{ curriculum_version_id, node_type, node_id, section_id, employment_id }` |
| **Triggered when** | Teacher marks topic/subtopic completed |
| **Mode** | **Async** — DESIGNED |

---

### AF1. `assessment_framework.published`

| | |
|--|--|
| **Producer** | E31 Assessment Framework |
| **Consumers** | E28 Audit; future E11 ops / E20 |
| **Payload** | `{ framework_id, assessment_framework_version_id, version }` |
| **Triggered when** | Framework published / version bumped |
| **Mode** | **Async** — DESIGNED |

---

### AF2. `assessment_framework.cloned`

| | |
|--|--|
| **Producer** | E31 |
| **Consumers** | E28 |
| **Payload** | `{ source_framework_id, new_framework_id, target_academic_year_id }` |
| **Triggered when** | Framework cloned to another year/class/subject |
| **Mode** | **Async** — DESIGNED |

---

### AR1. `assessment_recording.record.created`

| | |
|--|--|
| **Producer** | E32 Assessment Recording |
| **Consumers** | E28; future E22 |
| **Payload** | `{ record_id, framework_category_id, section_id }` |
| **Triggered when** | Teacher creates an assessment record |
| **Mode** | **Async** — DESIGNED |

---

### AR2. `assessment_recording.record.locked`

| | |
|--|--|
| **Producer** | E32 |
| **Consumers** | E28; portals |
| **Payload** | `{ record_id, locked_by }` |
| **Triggered when** | Admin/HOD locks a record |
| **Mode** | **Async** — DESIGNED |

---

### 57. `reporting.job.requested`

| | |
|--|--|
| **Producer** | E21 |
| **Consumers** | E21 workers, E28 |
| **Payload** | `{ job_id, report_key, params_hash }` |
| **Triggered when** | User/API requests report |
| **Mode** | **Async** |

---

### 58. `reporting.job.completed`

| | |
|--|--|
| **Producer** | E21 |
| **Consumers** | E19 (email file), E27 (store), E28 |
| **Payload** | `{ job_id, media_asset_id?, status }` |
| **Triggered when** | Report file ready or failed |
| **Mode** | **Async** |

---

### 59. `analytics.batch.completed`

| | |
|--|--|
| **Producer** | E22 |
| **Consumers** | E23 (feature refresh), dashboards |
| **Payload** | `{ batch_id, mart_names[] }` |
| **Triggered when** | ETL/mart build finishes |
| **Mode** | **Async** |

---

### 60. `ai.suggestion.proposed`

| | |
|--|--|
| **Producer** | E23 |
| **Consumers** | UI inboxes, E28 |
| **Payload** | `{ suggestion_id, target_engine, target_ref, kind }` |
| **Triggered when** | Model emits suggestion |
| **Mode** | **Async** |

---

### 61. `ai.suggestion.accepted`

| | |
|--|--|
| **Producer** | E23 (after human accept) |
| **Consumers** | **Owning domain engine** via command; E28 |
| **Payload** | `{ suggestion_id, command_name, command_payload }` |
| **Triggered when** | User accepts AI suggestion |
| **Mode** | **Sync** (user expects immediate apply attempt) |

---

### 62. `marketplace.listing.published`

| | |
|--|--|
| **Producer** | E24 |
| **Consumers** | E19 (optional), E22, public CDN invalidate |
| **Payload** | `{ listing_id, teacher_profile_id }` |
| **Triggered when** | Listing published |
| **Mode** | **Async** |

---

### 63. `onboarding.step.completed`

| | |
|--|--|
| **Producer** | E25 |
| **Consumers** | E22, E28; may cascade domain events already emitted by step engines |
| **Payload** | `{ school_id, step_slug }` |
| **Triggered when** | Wizard Continue succeeds for a step |
| **Mode** | **Sync** |

---

### 64. `ingestion.job.committed`

| | |
|--|--|
| **Producer** | E26 |
| **Consumers** | E25, E22, E28; domain events should also fire per row from owners |
| **Payload** | `{ job_id, school_id, counts }` |
| **Triggered when** | Blocking import fully committed |
| **Mode** | **Async** |

---

### 65. `ingestion.job.failed`

| | |
|--|--|
| **Producer** | E26 |
| **Consumers** | E25 UI, E28 |
| **Payload** | `{ job_id, error_manifest_ref }` |
| **Triggered when** | Validation/commit failure (no partial domain writes) |
| **Mode** | **Async** |

---

### 66. `media.asset.uploaded`

| | |
|--|--|
| **Producer** | E27 |
| **Consumers** | E04/E07/E20 (attach path), E28 |
| **Payload** | `{ media_asset_id, purpose, school_id? }` |
| **Triggered when** | Binary stored |
| **Mode** | **Async** |

---

### 67. `audit.entry.recorded`

| | |
|--|--|
| **Producer** | E28 |
| **Consumers** | SIEM exporters (future); rarely other engines |
| **Payload** | `{ audit_id, action, entity_ref }` |
| **Triggered when** | AuditEntry appended (may mirror other events) |
| **Mode** | **Async** |

---

## 5. Human ↔ catalogue name map

| Human phrase | Event name |
|--------------|------------|
| Student Admitted | `enrollment.student.admitted` |
| Teacher Joined | `workforce.teacher.joined` |
| Attendance Marked | `attendance.record.marked` |
| Assessment Created | `assessment.exam.created` |
| Exam Published | `assessment.exam.published` |
| Event Completed | `engagement.event.completed` |
| Report Generated | `document.report_card.generated` / `reporting.job.completed` |
| Notification Sent | `notification.delivery.sent` |
| Academic Year Closed | `calendar.academic_year.closed` |

---

## 6. Consumer duty matrix (selected)

| Consumer | Must react to | Must not |
|----------|---------------|----------|
| E15 Fee | `enrollment.*`, `attendance.threshold.breached`, `payment.transaction.succeeded/refunded` | Write payment provider state |
| E16 Payments | `fee.invoice.created/voided` (optional intent prep) | Write ledger tables |
| E19 Notification | `communication.message.ready_for_delivery` + selected domain alerts | Own message copy |
| E20 Document | `assessment.results.published`, `enrollment.student.transferred`, `payment.transaction.succeeded` | Invent marks |
| E03 AuthZ | `identity.*`, `workforce.teacher.*`, `enrollment.student.*` | Own membership rows |
| E23 AI | `analytics.batch.completed`, domain published events | Write OLTP on propose |

---

## 7. Implementation roadmap (no code now)

1. **In-process mediator** matching this catalogue (dev).  
2. **Transactional outbox** per school DB.  
3. **Async worker** for E18/E19/E20/E22/E23.  
4. **Idempotency store** keyed by `event_id`.  
5. Deprecate direct cross-engine writes as each consumer lands.

---

## 8. Relation to other architecture docs

| Doc | Role |
|-----|------|
| `business-engines.md` §12 | Superseded as **summary**; **this file is canonical** |
| `domain-model.md` | Entities whose lifecycle transitions emit events |
| `MASTER.md` §20 | Index + planning pointer |
| `rbac.md` | Who may emit/consume via permission keys |
| `versioning.md` | Whether the write may mutate history or must version |
| `audit-log.md` | Actor + diffs for the same write; `audit.entry.recorded` |
| `notification-engine.md` | How `*.ready_for_delivery` / domain alerts become channel sends |
| `ai-architecture.md` | Consumes events/marts; emits `ai.suggestion.*` only |

---

## 9. Maintenance

| Change | Action |
|--------|--------|
| New cross-engine effect | Add event here first |
| Payload field added | Bump notes; keep `event_version` if backward compatible |
| Sync↔Async change | Document reason (latency vs consistency) |

---

*End of system event catalogue.*
