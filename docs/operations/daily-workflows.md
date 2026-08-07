# FeezypayERP — Daily Operational Workflows

> **Phase:** 2 — Operations (design first)  
> **Created:** 2026-08-07  
> **Status:** Architecture audit + workflow catalogue. **No application code in this deliverable.**  
> **Scope:** Routine school work **after** Phase 1 configuration is complete (years, structure, subjects, timetable, exam defs, policies, templates, houses/clubs, etc.).  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`user-journeys.md`](../architecture/user-journeys.md) · [`business-engines.md`](../architecture/business-engines.md) · [`rbac.md`](../architecture/rbac.md) · [`system-events.md`](../architecture/system-events.md) · [`notification-engine.md`](../architecture/notification-engine.md) · [`ai-architecture.md`](../architecture/ai-architecture.md) · [`domain-model.md`](../architecture/domain-model.md) · [`phase-1-implementation-audit.md`](../architecture/phase-1-implementation-audit.md)

---

## 1. Purpose

Phase 1 shipped **configuration**. Phase 2 begins with **operations**: what people do every day, week, and term once the school is set up.

This document:

1. Audits the architecture for post-config operational surfaces.  
2. Lists **every daily / routine workflow** by persona.  
3. For each workflow records: **Trigger · Owner · Data Created · Data Updated · Dependencies · Notifications · Future AI opportunities**.  
4. Separates **periodic** ops (exam cycles, fees, PTM, report cards) that still recur after config.  
5. States maturity so implementers do not confuse catalogs with facts.

**Rule:** Implementation of Phase 2 features must start **only after** this catalogue is accepted. Each feature PR must cite a workflow ID from this file.

---

## 2. Architecture audit summary (post-config)

### 2.1 What “configuration complete” means

| Plane | Typical state |
|-------|----------------|
| Tenancy | `schools.onboarding_status = completed` |
| Calendar / structure | Active year, terms, classes, sections |
| People | Staff employments + student admissions/placements (+ parents) |
| Academics config | Subjects, offers, timetable published, exam definitions/schedules |
| Policies / templates | Attendance & promotion policies; report-card templates; comm templates |
| Optional | Houses/clubs, departments, grading scales |

### 2.2 Engine readiness for operations

| Engines | Role in daily ops | Maturity |
|---------|-------------------|----------|
| E05 Workforce, E06 Enrollment | People moves | Mostly **SHIPPED** (Admin UI/API) |
| E07–E10, E08, E17 events | Structure, timetable, calendar truth | Config **SHIPPED**; mid-year edits partial |
| E11 Assessment | Marks / results | Config **SHIPPED**; results **NOT BUILT** |
| E12 Attendance, E13 Conduct, E14 Health | Daily facts | **DEFERRED / NOT BUILT** |
| E15 Fee, E16 Payments | Collections | **NOT BUILT** (brand core) |
| E18 Communication, E19 Notification | Messaging | Config **SHIPPED**; send **NOT BUILT** |
| E20 Documents | Report cards / certificates | Templates **SHIPPED**; issue **NOT BUILT** |
| E21–E23 Reporting / Analytics / AI | Dashboards & assist | **NOT BUILT** |
| E03 Authorization | Persona scopes | Design only; today Admin-only login |
| E28 Audit | Compliance trail | Config writes partial |

### 2.3 Design constraints that bind Phase 2

| Constraint | Source |
|------------|--------|
| One owner per fact; reference, don’t duplicate | `business-engines.md` |
| Marks, attendance, invoices, issued PDFs: append / compensate — don’t rewrite history | `versioning.md` |
| Delivery ≠ content (E18 compose → E19 deliver) | engines + notification doc |
| AI proposes; humans accept under RBAC | `ai-architecture.md` |
| Portals blocked until F11 + membership RLS | §26 / §40 P0 |
| Phase 1 production gate still open | `phase-1-implementation-audit.md` |

### 2.4 Personas in this catalogue

| Persona | How assigned (target) | Login today |
|---------|----------------------|-------------|
| School Admin | `profiles.role = school_admin` | Yes |
| Principal | Employment designation / grant | No |
| Vice Principal | Employment designation / grant | No |
| HOD | `is_hod` + `department_id` | No (flag data exists) |
| Teacher | Active `teacher_employments` | No |
| Student | Active admission / placement | No |
| Parent | `parent_profiles` + links | No |
| Support Staff | Future roles: Accountant, Receptionist, Counsellor, Librarian | No |

---

## 3. How to read each workflow

| Field | Meaning |
|-------|---------|
| **ID** | Stable identifier (`WF-<persona>-NN`) — cite in PRs |
| **Cadence** | Daily · Weekly · Adhoc · Term · Year |
| **Trigger** | What starts the workflow |
| **Owner** | Persona (or System) primarily responsible for the write |
| **Data Created** | New rows / artifacts |
| **Data Updated** | Existing rows mutated (status, end dates, pointers) |
| **Dependencies** | Engines / prior config / other workflows required |
| **Notifications** | Types from `notification-engine.md` (via E18→E19) |
| **AI** | Services from `ai-architecture.md` (propose only) |
| **Status** | `SHIPPED-partial` · `CONFIG-ready` · `DESIGNED` |

**Owner ≠ sole actor.** Approvers and consumers appear in Dependencies / Notifications.

---

## 4. Cross-persona chains (canonical)

These are the spine of Phase 2. Detail lives under each persona; this section shows the handoff.

### 4.1 Absence → parent alert

```text
Teacher marks attendance (E12)
  → attendance.record.marked
  → E18 composes attendance.absent_alert
  → E19 delivers to Parent
  → threshold? → attendance.threshold_breached → Parent + Admin
  → optional Fee fine command (E15)  [policy]
```

### 4.2 Results → report card

```text
Teacher enters marks (E11) → HOD/Pri/Admin publish/lock
  → assessment.results_published → Student/Parent
  → Teacher AI drafts remarks → teacher accept
  → E20 issues ReportCard (pinned template)
  → document.ready → Parent/Student
```

### 4.3 Fee due → pay

```text
Accountant/Admin/system creates invoice (E15)
  → fee.invoice_created → Parent
  → overdue job → fee.invoice_overdue
  → Parent pays (E16) → payment.succeeded
  → E15 ledger post → receipt (E20) → fee.payment_succeeded
```

### 4.4 Teacher invite

```text
Admin invites (E05) → access.invite (E19)
  → Teacher binds auth (E02/E04) → profile wizard
  → employment invited→active → workforce.teacher_joined
```

---

## 5. School Admin

**Focus:** Tenant office — people ops, collections oversight, announcements, year gates, exceptions.

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-ADM-01 | Admit student | Adhoc | Application / walk-in | School Admin | Admission, Placement, ParentLink (as needed), Person match | — | E04, E06, E09; active year | `enrollment.student_admitted` | `ai.suggest.placement` | SHIPPED-partial |
| WF-ADM-02 | Transfer / re-place student | Adhoc | Mid-year move request | School Admin | New Placement row (prefer) | End prior placement; section/house pointers | E06, E09, E07 houses | Parent notify (policy) | `ai.suggest.placement` | SHIPPED-partial |
| WF-ADM-03 | Withdraw student | Adhoc | Exit request | School Admin | Withdrawal record / history | Admission status; end placement | E06, E28 | `enrollment.withdrawn` | — | SHIPPED-partial |
| WF-ADM-04 | Hire / create employment | Adhoc | New staff | School Admin | Employment, EmploymentSubjects, optional invite | — | E04, E05, E02 invite | `access.invite`, later `workforce.teacher_joined` | — | SHIPPED-partial (invite F11) |
| WF-ADM-05 | End employment | Adhoc | Resignation / exit | School Admin | — | Employment status/end; clear HOD flags | E05, E10 (slots remain historical) | Optional staff digest | — | SHIPPED-partial |
| WF-ADM-06 | Publish announcement | Daily–Adhoc | Ops / emergency / notice | School Admin | Announcement (+ pinned template version) | Status → published | E18 config; E19 delivery | `communication.announcement` | `ai.draft.communication` | CONFIG-ready / send DESIGNED |
| WF-ADM-07 | Publish / approve calendar event | Adhoc | PTM, sports, trip | School Admin (or Pri) | CalendarEvent | Approval status | E17, E08 year/term | `engagement.event_published`, later reminder | Event summary (future) | SHIPPED-partial / notify DESIGNED |
| WF-ADM-08 | Review attendance thresholds | Daily | `attendance.threshold.breached` | School Admin | Optional fine invoice (policy) | Case notes / follow-up flags | E12 facts, E07 policies, E15 optional | `attendance.threshold_breached` | `ai.insight.attendance_risk` | DESIGNED |
| WF-ADM-09 | Triage fee failures / overdues | Daily | Dashboard / digests | School Admin / Accountant | — | Invoice status; recovery tasks | E15, E16, E21 | `fee.payment_failed`, `fee.invoice_overdue` | `ai.insight.fee_risk`, `ai.analytics.narrate` | DESIGNED |
| WF-ADM-10 | Approve / apply fee waiver | Adhoc | Parent/Pri request | School Admin (or Pri approve) | Concession / ledger adjust | Invoice balances | E15, E03, E28 | Payer update | — | DESIGNED |
| WF-ADM-11 | Void invoice / reverse payment | Adhoc | Error / dispute | School Admin | Reversal / void ledger | Invoice/payment status; cancel queued sends | E15, E16, E28 | Payer notice | — | DESIGNED |
| WF-ADM-12 | Triage conduct escalations | Adhoc | Serious incident | School Admin / Pri | — | Incident approval / sanctions | E13, E03 | `conduct.incident` | — | DESIGNED |
| WF-ADM-13 | Review failed imports / deliveries | Weekly | Bounce / CSV fail | School Admin | — | Job retry / quarantine | E26, E19, E28 | Ingestion digests | — | DESIGNED (ingest partial) |
| WF-ADM-14 | Review sensitive audit | Weekly | Compliance / dispute | School Admin | — | — (read) | E28 | `system.security_alert` if anomaly | Workload insight (future) | SHIPPED-partial writes |
| WF-ADM-15 | House / club membership assign | Adhoc | Mid-year assign | School Admin | Membership rows | Admission house pointer (sync) | E07 houses/clubs, E06 | — | — | SHIPPED-partial |
| WF-ADM-16 | Mid-year timetable republish | Adhoc | Staff change / conflict | School Admin | New grid version / slots (supersede) | Prior slots archived/locked | E10, E05, E28 | Timetable publish notify | `ai.suggest.timetable` | SHIPPED-partial |
| WF-ADM-17 | Channel / quiet-hours ops | Adhoc | Policy change | School Admin | Consent / school channel settings | Quiet-hour rules | E18, E19 | Affects all deliveries | — | DESIGNED |
| WF-ADM-18 | Security alert response | Adhoc | Auth anomaly | School Admin | Audit notes | Access disable / password force (future) | E02, E03, E28 | `system.security_alert` | — | DESIGNED |

*Excluded here (config / setup, not daily ops):* first-time onboarding wizard, initial catalog seeding, first exam definition create — see Phase 1 docs.

---

## 6. Principal

**Focus:** School-wide academic & discipline oversight; high-risk approvals; publish gates.

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-PRI-01 | Morning ops review | Daily | Start of day | Principal | — | — (read dashboards) | E11–E13, E15, E21–E22 | Digests | `ai.analytics.narrate`, `ai.insight.academic` | DESIGNED |
| WF-PRI-02 | Approve serious conduct | Adhoc | Severity threshold | Principal | Approval record | Incident status / sanctions | E13, E03, E28 | `conduct.incident` | — | DESIGNED |
| WF-PRI-03 | Approve fee waiver | Adhoc | Waiver request | Principal | Approval | Concession applied (via E15) | E15, E03 | Payer update | `ai.insight.fee_risk` | DESIGNED |
| WF-PRI-04 | School-wide parent messaging | Daily–Adhoc | Event / crisis / notice | Principal | Announcement / event publish | Status | E17, E18, E19 | Announcement / `engagement.event_*` | `ai.draft.communication` | DESIGNED send |
| WF-PRI-05 | HOD department health review | Weekly | Dept cycle | Principal | — | — (read) | E05 dept, E10, E11, E22 | Optional dept digests | `ai.insight.academic` | DESIGNED |
| WF-PRI-06 | Approve / oversee exam calendar publish | Weekly–Term | Exam window | Principal | — | Exam publishing_status | E11, E08, E03 | `assessment.exam_published` | — | CONFIG-ready defs |
| WF-PRI-07 | PTM / event oversight | Term | PTM schedule | Principal | — | Event approval | E17, E08 | `engagement.event_*` | — | SHIPPED-partial entity |
| WF-PRI-08 | Results publish oversight | Term | Entry complete | Principal | — | Results lock/publish | E11, E03, E28 | `assessment.results_published` | — | DESIGNED |
| WF-PRI-09 | Report-card readiness | Term | Issue window | Principal | — | Issue approval | E20, E11, E12 | Later `document.ready` | Staff `ai.draft.report_narrative` | CONFIG-ready templates |
| WF-PRI-10 | Promotion decisions | Term–Year | Year-end gates | Principal | Promotion decisions | Placements for next year | E06, E09, E11, E12 policies | Enrollment events | `ai.suggest.placement` | DESIGNED |
| WF-PRI-11 | Year-close sign-off | Year | Close checklist | Principal + Admin | Sign-off audit | Year status → closed | E08, many consumers, E28 | Year closed events | Must not bypass locks | Shell SHIPPED; playbook DESIGNED |

---

## 7. Vice Principal

**Focus:** Same operational surface as Principal for academics, attendance, conduct, events, assessment publish, fee **waiver approve**, reporting — **minus** year-close unlock, destructive deletes, and `school_admin` role grants (`rbac.md`).

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-VP-01 | Day-to-day academic & ops oversight | Daily | Ops review | Vice Principal | — | — (read + limited approve) | E08–E13, E17, E21–E22 | Same digests as Pri | Narrate / academic / attendance risk | DESIGNED |
| WF-VP-02 | Conduct approve (non-terminal) | Adhoc | Incident | Vice Principal | Approval | Incident status | E13, E03 | `conduct.incident` | — | DESIGNED |
| WF-VP-03 | Fee waiver approve | Adhoc | Request | Vice Principal | Approval | Via E15 concession | E15, E03 | Payer update | `ai.insight.fee_risk` | DESIGNED |
| WF-VP-04 | Assessment / results publish (if granted) | Term | Entry complete | Vice Principal | — | Publish/lock | E11, E03 | `assessment.results_published` | — | DESIGNED |
| WF-VP-05 | Event / announcement publish assist | Adhoc | School occasion | Vice Principal | Announcement/event | Status | E17, E18, E19 | Event / announcement types | `ai.draft.communication` | DESIGNED |
| WF-VP-06 | Audit read (sensitive) | Weekly | Compliance | Vice Principal | — | — | E28 | Security alerts (read) | — | DESIGNED |

*Escalate to Principal/Admin:* year unlock, tenant suspend, destructive catalog deletes, school_admin grants.

---

## 8. HOD (Head of Department)

**Focus:** Department coverage, assessment quality, dept communications. Scope ◐ department.

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-HOD-01 | Coverage vs timetable check | Daily | Period conflicts / leave | HOD | — | Optional coverage notes | E05 assignments, E10 slots | Timetable publish affecting dept | `ai.suggest.timetable` (dept) | SHIPPED-partial data |
| WF-HOD-02 | Support / coach teachers | Daily | Teacher request | HOD | Dept announcement / resource | Membership roles | E05 dept engine | Optional | `ai.chat.assistant` | SHIPPED-partial |
| WF-HOD-03 | Moderate marks entry quality | Weekly | Entry window | HOD | Review notes | Reject/return drafts (policy) | E11 results (◐) | `assessment.exam_published` | `ai.insight.academic` | DESIGNED |
| WF-HOD-04 | Track assessment progress | Weekly | Mid-exam cycle | HOD | — | — (completion views) | E11 schedules, E21 | Exam published | Academic insight | CONFIG-ready schedules |
| WF-HOD-05 | Dept-scoped announcement | Adhoc | Dept notice | HOD | DepartmentAnnouncement | Publish status | E05/E18, E19 | Announcement (dept audience) | `ai.draft.communication` | SHIPPED-partial / send DESIGNED |
| WF-HOD-06 | Conduct note (dept student) | Adhoc | Behaviour | HOD | ConductIncident (scoped) | — | E13, E06 roster | `conduct.incident` (policy) | — | DESIGNED |
| WF-HOD-07 | Lesson-plan coverage review | Term | Curriculum check | HOD | Review / share flags | LessonPlan status | E10 LessonPlan, E23 | `timetable.lesson_plan.shared` | `ai.draft.lesson_plan` (review) | DESIGNED |
| WF-HOD-08 | Request staffing / eligibility change | Adhoc | Load imbalance | HOD (request) → Admin execute | Change request | EmploymentSubjects (Admin) | E05 | Optional staffing notify | — | DESIGNED portal |
| WF-HOD-09 | Align department exams | Term | Term exam map | HOD | Suggested schedule edits | Exam defs/schedules (policy) | E11, E08 | `assessment.exam_published` | Academic insight | CONFIG-ready |

*Out of scope:* school-wide fee ops, year close, hiring execute, other departments’ data.

---

## 9. Teacher

**Focus:** Class delivery — attendance, marks, conduct, parent messaging, planning.

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-TCH-01 | Mark attendance | Daily | Period / day end | Teacher | AttendanceRecord(s) | Corrections (policy window) | E12, E06 roster, E08 working day, E10 optional slot | → `attendance.absent_alert`; digest `attendance.marked_digest` | `ai.insight.attendance_risk` | SHIPPED UI (§59) |
| WF-TCH-02 | Teach from timetable | Daily | Period start | Teacher | — | — (consume slots) | E10 published grid | Grid publish notify | `ai.chat.assistant` | SHIPPED data / portal homepage |
| WF-TCH-03 | Log conduct incident | Adhoc | Behaviour event | Teacher | ConductIncident | — | E13, E06 | `conduct.incident` | — | SHIPPED UI (§59) |
| WF-TCH-04 | Message class parents / homework | Daily–Adhoc | Absence follow-up / notice / assign | Teacher | Message / homework | Send status | E18, E19, homework, consent | Parent channels | `ai.draft.communication` | SHIPPED homework UI (§59); parent message compose partial |
| WF-TCH-05 | Enter / update marks | Weekly–Term | Assessment open | Teacher | AssessmentResult rows | Draft updates until lock | E11 def/schedule, E07 scale pin | (staff until publish) | Must not silent-write via AI | SHIPPED UI (§59) |
| WF-TCH-06 | Follow up absences | Weekly | Digest / parent reply | Teacher | Follow-up notes / messages | Attendance follow-up flags | E12, E18 | Digest | Attendance risk | DESIGNED |
| WF-TCH-07 | Draft / share lesson plan | Weekly | Planning cycle | Teacher | LessonPlan | Share status | E10, E23 | lesson_plan.shared | `ai.draft.lesson_plan` | DESIGNED |
| WF-TCH-08 | Draft report remarks | Term | Report window | Teacher | Narrative draft | Accepted into result/card | E11/E20, E23 | — | `ai.draft.report_narrative` | DESIGNED |
| WF-TCH-09 | Prepare PTM notes | Term | PTM event | Teacher | PTM notes (future entity or docs) | — | E17, E11, E12 views | `engagement.event_*` | Chat + narrative | DESIGNED |
| WF-TCH-10 | Complete own profile | Ongoing | Invite / incomplete | Teacher | — | Person / TeacherProfile | E04, E02 | Invite / profile reminders | — | SHIPPED data / login DESIGNED |
| WF-TCH-11 | View own teaching load | Daily | School day | Teacher | — | — | E10, E05 assignments | — | Chat “next period” | DESIGNED portal |

---

## 10. Student

**Focus:** Self-service consume (+ limited profile / pay). Age/consent gates (RBAC-4).

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-STU-01 | View own timetable | Daily | School day | Student | — | — | E10 | Timetable publish | `ai.chat.assistant` | DESIGNED (optional route later) |
| WF-STU-02 | Read announcements | Daily | Publish | Student | — | Read receipts (future) | E18, E19 | `communication.announcement` | — | SHIPPED UI (§60) |
| WF-STU-03 | Check own attendance | Daily | After mark | Student | — | — | E12 | Usually parent-first alerts | Chat over self facts | SHIPPED UI (§60) |
| WF-STU-04 | Track exams / homework | Weekly | Exam published / plan shared | Student | — | — | E11, homework | `assessment.exam_published` | Study tips | SHIPPED UI (§60) RO |
| WF-STU-05 | View published results | Term | Results publish | Student | — | — | E11 published only | `assessment.results_published` | Explain own grades | SHIPPED UI (§60) |
| WF-STU-06 | Download report card | Term | Document issued | Student | — | Download audit (optional) | E20 | `document.ready` | Must not invent certificates | SHIPPED list UI (§60); PDF FUTURE |
| WF-STU-07 | Self-pay fees (if payer) | Adhoc | Invoice | Student | PaymentIntent | — | E15, E16 | `fee.*` if payer | — | DESIGNED |
| WF-STU-08 | Update age-gated profile / media | Ongoing | Policy | Student | MediaAsset (photo) | Person fields (gated) | E04, E27 | — | — | DESIGNED (RO profile §60) |
| WF-STU-09 | Event awareness / RSVP (future) | Term | Event publish | Student | RSVP | — | E17 | `engagement.event_*` | — | SHIPPED participation read (§60) |

*Must not:* peer data, sibling fees, staff PII, unpublished marks.

---

## 11. Parent / Guardian

**Focus:** Linked children only — presence, fees, academics, school life.

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-PAR-01 | Act on absence alert | Daily | Child marked absent | Parent | Optional reply message | Consent unchanged | E12, E19, ParentLink | `attendance.absent_alert`, `threshold_breached` | Parent AI Q&A | DESIGNED |
| WF-PAR-02 | Read school messages | Daily | Announcement / event | Parent | — | Read state (future) | E18, E19, Consent | Announcements, `engagement.event_*` | Draft question to teacher | DESIGNED |
| WF-PAR-03 | Review fees due | Weekly | Invoice / overdue | Parent | — | — | E15 | `fee.invoice_created` / `_overdue` | Explain due amount | DESIGNED |
| WF-PAR-04 | Pay invoice | Adhoc | Pay CTA | Parent | PaymentIntent / Payment | — | E16 → E15 ledger | `fee.payment_succeeded` / `_failed` | — | DESIGNED |
| WF-PAR-05 | Track homework / exams | Weekly | Exam publish | Parent | — | — | E11, E10 (child) | `assessment.exam_published` | Chat linked child only | DESIGNED |
| WF-PAR-06 | View results & report cards | Term | Publish / issue | Parent | — | — | E11, E20 | `results_published`, `document.ready` | Plain-language grades | DESIGNED |
| WF-PAR-07 | PTM / event RSVP | Term | Event publish | Parent | RSVP | — | E17 | `engagement.event_published` / reminder | — | DESIGNED |
| WF-PAR-08 | Update contacts / consent / limited health | Ongoing | Preference change | Parent | Consent prefs | ParentProfile; health cols (policy) | E04, E14, E18 | — | — | DESIGNED |
| WF-PAR-09 | Respond to conduct notice | Adhoc | Incident | Parent | Acknowledgement (future) | — | E13 | `conduct.incident` (policy) | — | DESIGNED |
| WF-PAR-10 | Request fee concession | Adhoc | Hardship | Parent | Concession request | — | E15 → Adm/Pri approve | Status updates | — | DESIGNED |

---

## 12. Support Staff

Support Staff is **not** one RBAC row; it is a family of future personas (`rbac.md` §3.2). Workflows below are first-class Phase 2 candidates once Accountant / Receptionist / etc. ship.

### 12.1 Accountant / fee clerk

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-SUP-ACC-01 | Generate invoices (cycle) | Cycle | Fee calendar / cron | Accountant | Invoices, LedgerEntries | Plan assignment pointers | E15, E06, E09, FeePlan versions | `fee.invoice_created` | — | DESIGNED |
| WF-SUP-ACC-02 | Post concession / scholarship | Adhoc | Approved request | Accountant | Concession, ledger | Invoice balance | E15, E03 approve | Payer update | — | DESIGNED |
| WF-SUP-ACC-03 | Reconcile payments | Daily | Webhook / bank file | Accountant | Reconciliation rows | Payment / ledger status | E16, E15 | `fee.payment_succeeded` / `_failed` | — | DESIGNED |
| WF-SUP-ACC-04 | Chase overdues | Daily–Weekly | Overdue job | Accountant | Reminder jobs | Invoice overdue flags | E15, E18, E19 | `fee.invoice_overdue` | `ai.insight.fee_risk` | DESIGNED |
| WF-SUP-ACC-05 | Finance export / close period | Weekly–Term | Board / audit | Accountant | ReportingJob | Period close flags | E21, E15 | Job complete | Narrate (scoped) | DESIGNED |

*RBAC:* `fee.*` + payment read; **no** assessment publish / year close.

### 12.2 Receptionist / front office

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-SUP-RCP-01 | Create identity / start admission | Daily | Walk-in | Receptionist | Person, draft Admission, ParentLink | — | E04, E06 | Later admit notify | Placement suggest (Admin accept) | DESIGNED |
| WF-SUP-RCP-02 | Direct parents / visitors | Daily | Front desk | Receptionist | Visitor log (future) | — | E18 read announcements | — | — | DESIGNED |
| WF-SUP-RCP-03 | Issue routine certificates request | Adhoc | Parent request | Receptionist | Document request | — | E20 → Admin/Pri issue | Later `document.ready` | — | DESIGNED |

*Must not:* fee void, marks publish, role grants.

### 12.3 Counsellor

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-SUP-COU-01 | Manage conduct case | Adhoc | Referral | Counsellor | Case notes / interventions | Incident status | E13 | Controlled parent notify | Summarize conduct (future) | DESIGNED |
| WF-SUP-COU-02 | Limited health context review | Adhoc | Need-to-know | Counsellor | — | — (read E14) | E14, E03 | — | — | DESIGNED |

### 12.4 Librarian

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-SUP-LIB-01 | Media / handbook catalog ops | Adhoc | Library workflow | Librarian | MediaAsset metadata | Archive flags | E27, E20 subset | — | RAG source for AI | DESIGNED |

---

## 13. Periodic operations index (after config)

Recurring ops that are **not** one-time setup. Detail is in persona tables; this index aids Phase 2 sequencing.

| ID | Name | Primary personas | Engines | Cadence | Status |
|----|------|------------------|---------|---------|--------|
| WF-PER-01 | Exam window → marks → lock/publish | Tch → HOD → Pri/Adm | E11, E08, E03, E28 | Term / exam | CONFIG + DESIGNED results |
| WF-PER-02 | Report card issue | Tch remarks → Pri/Adm | E20, E11, E12 | Term | Templates ready; issue DESIGNED |
| WF-PER-03 | PTM cycle | Adm/Pri, Tch, Par | E17, E18, E19 | Term | Entity partial; RSVP/notify DESIGNED |
| WF-PER-04 | Fee billing cycle | Acc/Adm, Par | E15, E16, E20, E19 | Monthly/term | DESIGNED |
| WF-PER-05 | Attendance policy / fine | System, Adm, Par | E12, E15, policies | Ongoing | Policy CONFIG; runtime DESIGNED |
| WF-PER-06 | Timetable mid-term supersede | Adm/Pri/HOD | E10, E28 | Adhoc–term | SHIPPED-partial |
| WF-PER-07 | Promotion / placement batch | Adm/Pri | E06, E09, E11, E12 | Year | DESIGNED |
| WF-PER-08 | Year activate / close / rollover | Adm (+ Pri) | E08 + consumers | Year | Shell SHIPPED; playbook DESIGNED |
| WF-PER-09 | Bulk certificates / TC | Adm/Pri | E20, E06, E04 | Term/adhoc | DESIGNED |
| WF-PER-10 | Sports / trips / annual day | Adm, Tch, Par/Stu | E17, E14, E19 | Term/year | DESIGNED notify |
| WF-PER-11 | House/club competitions | Adm, TIC | E07, E17 | Term | Memberships SHIPPED; points deferred |
| WF-PER-12 | Compliance exports | Adm, Acc, Pri | E21, E28 | Weekly–term | DESIGNED |
| WF-PER-13 | Analytics refresh | System → leadership | E22, E23 | Daily–weekly | DESIGNED |

---

## 14. System / automated workflows

| ID | Workflow | Cadence | Trigger | Owner | Data Created | Data Updated | Dependencies | Notifications | AI | Status |
|----|----------|---------|---------|-------|--------------|--------------|--------------|---------------|-----|--------|
| WF-SYS-01 | Overdue fee job | Daily | Schedule | System | Overdue events | Invoice flags | E15 outbox | `fee.invoice_overdue` | Fee risk scores | DESIGNED |
| WF-SYS-02 | Attendance threshold job | Daily | Aggregate | System | Threshold events | — | E12, policies | `attendance.threshold_breached` | Attendance risk | DESIGNED |
| WF-SYS-03 | Event reminders | Schedule | T−N before start | System | Reminder jobs | — | E17, E19 | `engagement.event_reminder` | — | DESIGNED |
| WF-SYS-04 | Delivery retries | Continuous | Failed attempt | System | DeliveryAttempt | Status | E19 | Channel-specific | — | DESIGNED |
| WF-SYS-05 | Analytics mart refresh | Daily–Weekly | Cron | System | Marts / snapshots | Refresh watermark | E22 | — | Feeds narrate / insights | DESIGNED |

---

## 15. Phase 2 sequencing (design guidance only)

**Do not implement until this catalogue is accepted.** Suggested order after P0 prerequisites (F11, membership RLS, outbox where needed):

1. **Teacher daily spine:** WF-TCH-01 attendance (+ parent alert chain) — highest daily volume.  
2. **Assessment results path:** WF-TCH-05 → WF-HOD-03 → WF-PRI-08 → WF-PER-02.  
3. **Fee spine:** WF-SUP-ACC-01…04 + WF-PAR-03/04 (Fee deep-dive first).  
4. **Comms send:** E19 for announcements/alerts already composed.  
5. **Portals:** Teacher → Parent → Student → leadership personas.  
6. **Support roles:** Accountant before Fee MVP UI; Receptionist after invite model.

Hard prerequisites from architecture review / Phase 1 audit remain binding: **do not start Fee UI, WhatsApp, or multi-persona portals** until F11 + membership RLS (+ Fee design for money).

---

## 16. Placement rule

Every Phase 2 feature / PR must name:

1. **Workflow ID(s)** from this document  
2. **Persona(s)**  
3. **Owning engine** (write authority)  
4. **Trigger**  
5. **Data created / updated**  
6. **Notification types** (or none)  
7. **AI services** (or none)  
8. **Maturity delta** (what becomes SHIPPED)

Align with `rbac.md`, `versioning.md`, `notification-engine.md`, `ai-architecture.md`.

---

## 17. Maintenance

| Change | Action |
|--------|--------|
| New daily ops task | Add workflow row + ID |
| Persona portal ships | Flip Status column |
| New notify / AI type | Update Notifications / AI cells |
| Workflow retired | Mark deprecated; do not reuse ID |

---

*End of daily workflows. Companion: MASTER §41. Implementation begins only after acceptance of this catalogue.*
