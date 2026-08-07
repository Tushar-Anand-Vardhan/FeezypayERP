# FeezypayERP — Phase 2 Operations Audit

> **Role:** Implementation / production-readiness review of Phase 2 operational backends & workflows  
> **Date:** 2026-08-07  
> **Status:** Phase 2 engines **largely SHIPPED (backend-first)** · Production gate **NOT PASSED** · Phase 2 **not marked COMPLETE**  
> **Scope:** MASTER §§41–53 · `docs/operations/daily-workflows.md` · migrations `20260807230000`–`20260807330000` · `lib/{student-profile,teacher-workspace,attendance,assessment,report-cards,events,behaviour,communications,notifications,homework,student-analytics,teacher-analytics,principal-dashboard}` · minimal UIs  
> **Verdict:** Strong **admin-only backend spine** for attendance, marks, report cards, events, behaviour, homework, communications (in_app), and analytics/dashboards. **Not production-ready** for multi-persona school ops. Fee / portals / provider notify / membership RLS remain open. Do **not** begin Phase 3 money/portal GA until gates below close.

---

## 1. Executive verdict

| Gate | Result |
|------|--------|
| Phase 2 workflow catalogue exists (§41) | PASS |
| Core ops engines backend-shipped (§44–§52) | PASS (with gaps) |
| Pure validation smokes for engines | PASS (§15.23–§15.34) |
| Data ownership (no OLTP duplication) | PASS (with notes) |
| Engine-local audit logs | PASS (partial vs E28) |
| Ops UI parity (teacher/admin mark/issue screens) | **PARTIAL** — Teacher Portal attendance/marks/homework/behaviour SHIPPED (§59); report-card issue UI still open |
| Multi-persona AuthN (F11 / membership RLS) | **PASS** (§55) |
| Multi-persona AuthZ (permission keys / guards) | **PASS** (§56) — portals still open |
| Domain-event → notify chains (absent alert, results published) | **PASS** (§58 — in_app + stub providers) |
| External notification providers | **FAIL** (stubbed by design) |
| Fee / Payments / Health ops | **FAIL** (not in Phase 2 ship set) |
| Phase 1 production gate (§40) closed | **FAIL** (still open) |
| Production-ready Phase 2 COMPLETE | **NO** |

**Phase 2 is not marked COMPLETE.** AuthN (§55), AuthZ (§56), Membership (§57), notify chains (§58), Teacher Portal (§59), and Student Portal (§60) closed major P0s; remaining gate items are report-card/admin UIs, live external providers, Fee/parent portals, and Phase 1 gate.

---

## 2. What was delivered (accepted as shipped backends)

| § | Deliverable | Module | Migration | UI | Smoke |
|---|-------------|--------|-----------|-----|-------|
| 41 | Daily workflows catalogue | — | — | design | §15.22 |
| 42 | Student Profile aggregate | `lib/student-profile/` | `…230000` stubs | none | §15.23 |
| 43 | Teacher Workspace | `lib/teacher-workspace/` | homework stub then §50 | `/dashboard/teacher` | §15.24 |
| 44 | Attendance Engine (E12) | `lib/attendance/` | `…250000` | **none** | §15.25 |
| 45 | Assessment Operations (E11) | `lib/assessment/` ops | `…260000` | **none** | §15.26 |
| 46 | Report Card issue (E20) | `lib/report-cards/` | `…270000` | **none** | §15.27 |
| 47 | Event & Activity (E17) | `lib/events/` | `…280000` | **none** | §15.28 |
| 48 | Behaviour (E13) | `lib/behaviour/` | `…290000` | **none** | §15.29 |
| 49 | Communication ops + Notify pipe | `lib/communications/` + `lib/notifications/` | `…300000` | **none** | §15.30 |
| 50 | Homework & Assignment | `lib/homework/` | `…310000` | **none** | §15.31 |
| 51 | Student Analytics (E22) | `lib/student-analytics/` | `…320000` | **none** | §15.32 |
| 52 | Teacher Analytics (E22) | `lib/teacher-analytics/` | `…330000` | **none** | §15.33 |
| 53 | Principal Dashboard | `lib/principal-dashboard/` | none | `/dashboard/principal` | §15.34 |

**Correctly deferred / out of Phase 2 ship set:** Fee (E15), Payments (E16), Health (E14), DigiLocker/PDF bytes, WhatsApp/SMTP/SMS providers, LessonPlan entity, staff biometric attendance, student self-submit homework, AI (E23).

---

## 3. What’s solid

1. **Archive / soft-delete discipline** on ops tables (`archived_at`, supersede patterns on attendance & exam results).
2. **Append / compensate** for locked attendance & marks — aligns with `versioning.md`.
3. **Report cards assemble by reference** (`source_refs`) — no parallel marks store (E20 P-rule).
4. **E18 compose → E19 deliver** boundary respected for communication messages; provider SDKs not embedded in Fee/Attendance.
5. **Deterministic analytics** (§51–§52) with documented thresholds; AI explicitly `not_built`.
6. **School-scoped RLS** + `getAuthenticatedSchoolContext` on server actions (admin-only assumption).
7. **Engine-local audit logs** on attendance, assessment, behaviour, events, homework, communications, analytics snapshots.
8. **Aggregators are honest** (Teacher Workspace, Principal Dashboard, Student Profile) — empty when no rows.
9. **Homework ≠ Assessment** ownership clear (§50 placement rule).
10. **Smoke coverage** for validation-heavy modules; migrations pushed through `20260807330000`.

---

## 4. Workflow coverage matrix

Maturity key for this audit:

| Tag | Meaning |
|-----|---------|
| `BE` | Backend actions/schema shipped |
| `UI` | Usable admin/teacher UI |
| `CHAIN` | Domain event → E18/E19 wired |
| `AUTH` | Correct persona can execute under RBAC |
| `GAP` | Catalogue workflow still open |

### 4.1 Spine workflows (highest priority)

| Workflow | Intent | BE | UI | CHAIN | AUTH | Verdict |
|----------|--------|----|----|-------|------|---------|
| WF-TCH-01 Mark attendance | Daily presence | ✓ | ✓ Teacher Portal | ✗ absent_alert | ✓ AuthN | **Partial** |
| WF-TCH-05 Enter marks | Results path | ✓ | ✓ Teacher Portal | ✗ results_published chain | ✓ | **Partial** |
| WF-HOD-03 / WF-PRI-08 Publish/lock | Oversight | ✓ sessions | ✗ admin UI | ✗ | ✗ | **Partial** |
| WF-PER-02 Issue report card | Documents | ✓ draft/issue | ✗ PDF | ✗ document.ready | ✗ | **Partial** |
| WF-TCH-03 / WF-PRI-02 Conduct | Behaviour | ✓ | ✓ Teacher Portal | ✗ notify polish | ✓ | **Partial** |
| WF-ADM-06 / WF-PRI-04 Messaging | Comms | ✓ in_app | ✗ | ✓ compose fan-out | ✗ | **Partial** |
| WF-ADM-07 / WF-PRI-07 Events | Calendar ops | ✓ activity | ✓ teacher read | ✗ | ✓ | **Partial** |
| WF-TCH-04 / WF-STU-04 Homework | Assignments | ✓ teacher record | ✓ teacher assign UI | — | ✓ | **Partial** |
| WF-PRI-01 Morning review | Dashboard | ✓ | ✓ minimal | — | admin only | **Partial** |
| WF-TCH-11 Teaching load | Workspace | ✓ | ✓ | — | admin picker / linked | **Partial** |

### 4.2 Missing / still DESIGNED (representative)

| Area | Workflows | Blocker |
|------|-----------|---------|
| Fee / payments | WF-ADM-09…11, WF-SUP-ACC-*, WF-PAR-03/04, WF-SYS-01 | E15/E16 not built; Fee deep-dive |
| Portals | WF-STU-*, WF-PAR-* (consume) | F11 + membership RLS + portals |
| Threshold jobs | WF-ADM-08, WF-SYS-02 | No cron + no policy→fine/notify wiring |
| Lesson plans | WF-TCH-07, WF-HOD-07 | No LessonPlan entity |
| Delivery retries | WF-SYS-04 | Outbox present; worker loop not built |
| Analytics refresh | WF-SYS-05 | Snapshots on-demand only |
| Year close / promotion | WF-PRI-10/11 | Playbook DESIGNED; shell year status only |
| Staff attendance | Principal “teacher attendance” | Proxy only; biometric FUTURE |

**Catalogue drift:** `daily-workflows.md` §2.2 still says E11 results / E12 / E13 / E18 send / E20 issue / E22 are NOT BUILT. **Refresh that maturity table** to match §§44–53 (backend shipped; UI/notify/auth still open).

---

## 5. Dimension reviews

### 5.1 Performance

| Finding | Severity | Notes |
|---------|----------|-------|
| Principal dashboard **N+1** over departments (memberships + subjects + results per dept) | HIGH | `loadDepartmentPerformance` sequential awaits — school with 20 depts × queries will lag |
| Communication fan-out **per-recipient person lookup** | HIGH | `message-actions` enriches auth_user_id in nested loops; large audiences expensive |
| Analytics / dashboard queries use `.limit(N)` without pagination UX | MED | Safe caps; large schools need paging / marts |
| No indexes review for “today’s sections missing attendance” join pattern | MED | Relies on existing session/date indexes |
| On-demand analytics regenerate full OLTP each call | MED | Snapshots help; no scheduled refresh (WF-SYS-05) |
| Teacher Workspace parallel loads | LOW | Generally OK |

**Improvements:** batch department performance; batch person→auth resolution; materialize daily attendance completion; add outbox worker before scaling notify.

### 5.2 Schema

| Finding | Severity | Notes |
|---------|----------|-------|
| Cross-school FK integrity still largely **app-enforced** (Phase 1 C2 carries forward) | CRITICAL | Ops FKs (section/subject/year) same risk |
| Period attendance schema-ready but API stubbed | MED | Documented FUTURE |
| Staff attendance OLTP missing | MED | Principal panel correctly documents proxy |
| Homework submissions student self-submit FUTURE | LOW | Schema ready |
| AI evaluation columns stubbed | LOW | Correct |
| Unified outbox for **domain events** | **CLOSED** (§58 `domain_event_outbox`) | |

**Improvements:** same-school CHECK/triggers or composite FKs; domain event outbox; staff attendance design when needed.

### 5.3 Permissions

| Finding | Severity | Notes |
|---------|----------|-------|
| AuthN F11 + membership RLS | **CLOSED** (§55) | Invite + `membership_schools` |
| E03 permission keys + `requirePermission` | **CLOSED** (§56) | Catalog / bundles / ABAC helpers |
| Parent portal UIs | HIGH | Teacher + Student portals SHIPPED (§59/§60); parent still open |
| RLS still membership-first (coarse) | MED | App enforces verb + ABAC; optional coarse SQL deny later |
| Visible-to-parent flags exist on facts but portals don’t consume | MED | Prep OK |

**Improvements:** ship portals on top of §56 keys; optional RLS `has_permission` policies for sensitive tables.

### 5.4 Versioning

| Area | Assessment |
|------|------------|
| Attendance corrections | Good — supersede + compensating row |
| Exam results | Good — append / correct / lock |
| Report card issues | Good — version history; draft→issue |
| Homework marks | Separate from E11 — correct ownership |
| Communications | Published messages not editable — OK |
| Analytics snapshots | Regenerate-able marts — OK |
| Config editing framework adoption on ops | N/A for facts; config still uneven (Phase 1 H-findings) |

**Gaps:** no formal “mark session version pin to grading scale version” audit beyond columns; lesson plan versioning absent.

### 5.5 Audit logging

| Finding | Severity | Notes |
|---------|----------|-------|
| Engine-local `*_audit_log` tables for core ops | PASS | attendance, assessment, behaviour, events, homework, comm |
| Unified `audit_entries` (E28) barely used outside editing framework | HIGH | Ops writes don’t consistently emit E28 |
| Principal/teacher analytics write snapshot audit | PASS | Local |
| No SIEM / retention worker | MED | Design-only |
| Sensitive field redaction policy not enforced in ops audits | MED | Free-text remarks/feedback may land in JSON |

**Improvements:** dual-write or bridge engine audits → E28; retention tiers; redact PII in `new_values`.

### 5.6 Notifications

| Finding | Severity | Notes |
|---------|----------|-------|
| E19 tables + `enqueueDelivery` + in_app stub | PASS | §49 |
| Email/WhatsApp/SMS/push left queued | Expected | Not production channels |
| Attendance mark → `attendance.absent_alert` | **CLOSED** (§58) | emit + orchestrator |
| Results publish → `assessment.results_published` | **CLOSED** (§58) | |
| Conduct → `conduct.incident` | **CLOSED** (§58) | |
| Event publish notify | **CLOSED** (§58 calendar published) | |
| Live WhatsApp/email providers | MED | Stub adapters until keys |
| Delivery retry worker (WF-SYS-04) | **CLOSED** (§58 worker + cron route) | |
| Consent / quiet hours not enforced at send | MED | |

**Improvements:** configure provider keys for live channels; quiet hours/consent later.

### 5.7 Dependencies

```text
Config (Phase 1) ──▶ Ops facts (E11/E12/E13/E17/Homework)
                         │
                         ├─▶ Student Profile / Teacher Workspace / Principal Dashboard (read)
                         ├─▶ E22 Analytics snapshots (read → mart)
                         └─▶ domain_event_outbox → orchestrator → E19 (§58)

Blocked by: Fee deep-dive, portal UIs, live provider keys
```

| Risk | Notes |
|------|-------|
| Dashboards assume active academic year | OK if onboarding complete |
| Marks UI missing → analytics empty | Expected until data entered |
| Fee workflows cited by Principal dashboards but E15 absent | Don’t over-claim “school health” for money |
| Phase 3 portals need live providers for production notify | Configure keys before portal GA |

---

## 6. Ownership & duplication review

| Temptation | Status |
|------------|--------|
| Student blob dump of marks/attendance | Avoided — profile loaders by reference |
| Report card copies marks OLTP | Avoided — `source_refs` |
| Homework marks in `exam_results` | Avoided |
| Analytics as second SoT | Avoided — regenerate snapshots |
| Communication stores delivery attempts | Avoided — E19 owns |
| Department announcements vs school `comm_messages` | Dual surfaces exist; link field optional — **document when to use which** |
| Teacher attendance vs student attendance | Proxy only — no duplicated staff fact table (good until staff attendance ships) |

**Broken / fuzzy ownership:**

| Item | Issue |
|------|-------|
| “Approval” of conduct | Behaviour has status fields; no distinct Principal approval entity / permission gate |
| Fee fine on attendance threshold | Policy stubs exist; E15 command path missing |
| Domain events catalogue | Designed; no runtime producers for most ops events |

---

## 7. Missing permissions (concrete)

Until E03 runtime ships, these keys from `rbac.md` are **unchecked** on live actions (non-exhaustive):

- `attendance.mark` / `attendance.approve` / `attendance.lock`
- `assessment.results.enter` / `assessment.results.publish` / `assessment.results.lock`
- `conduct.incident.record` / `conduct.incident.approve`
- `document.report_card.issue`
- `communication.message.publish`
- `engagement.event.approve`
- `analytics.dashboard.read`
- `homework.assign` / `homework.grade`

**Today:** school_admin session implies all of the above.

---

## 8. Scalability risks (summary)

1. Per-recipient notify enrichment loops.  
2. Principal department N+1.  
3. Unbounded fan-out without audience caps / chunking jobs.  
4. Sync in-process “workers” (in_app process) won’t survive volume.  
5. No read replicas / warehouse — OLTP used for analytics (acceptable early; not GA scale).  
6. Media uuid refs without lifecycle GC.

---

## 9. Suggested improvements before Phase 3

### P0 — must close (or waive in writing)

| ID | Action |
|----|--------|
| P2-P0-1 | **Do not mark Phase 2 COMPLETE** until this audit’s production gate passes or is waived |
| P2-P0-2 | Keep **F11 + membership RLS** as hard blockers for portals / teacher login |
| P2-P0-3 | Wire **domain → notify** for absent_alert, results_published, conduct.incident | **DONE** (§58) |
| P2-P0-4 | Close or re-accept **Phase 1 §40 P0** (FK integrity, archive purity) — ops inherit the same risks |
| P2-P0-5 | Ship **attendance + marks + report-card minimal UIs** for admin/teacher (or accept “API-only” with explicit risk) |

### P1 — before Fee / WhatsApp / portal GA

| ID | Action |
|----|--------|
| P2-P1-1 | Fee deep-dive + E15/E16 design (already Phase 0.5 debt) |
| P2-P1-2 | Notification outbox **worker** + provider adapters behind flags |
| P2-P1-3 | E03 permission checks on write actions |
| P2-P1-4 | Bridge engine audits → E28 `audit_entries` |
| P2-P1-5 | Refresh `daily-workflows.md` maturity table |
| P2-P1-6 | Fix Principal/comms N+1 hot paths |
| P2-P1-7 | Attendance threshold job (WF-SYS-02) using policy engine |

### P2 — Phase 3 candidates (after gate)

| Theme | Notes |
|-------|-------|
| Fee + Payments + parent pay | Brand core |
| Portals (Teacher → Parent → Student) | After F11 |
| Provider channels | WhatsApp/email |
| Lesson plans / period attendance / staff attendance | Ops depth |
| AI narration over E22 marts | After deterministic dashboards trusted |

---

## 10. Production gate checklist

| Check | Result |
|-------|--------|
| All Phase 2 engines have migrations + smoke | PASS |
| Critical notify chains live | **PASS** (§58 in_app / stubs) |
| Live external providers (WhatsApp/email) | **FAIL** (stub adapters) |
| Multi-persona AuthN / AuthZ platform | **PASS** (§55 / §56) |
| Parent/student portals consuming AuthZ | **FAIL** |
| Ops UIs for daily spine | **FAIL** |
| Fee spine | **FAIL** (deferred) |
| External providers | **FAIL** (stub) |
| Phase 1 gate | **FAIL** (open) |
| Scalability hotspots documented + owners | PASS (this doc) |
| Ownership anti-duplication | PASS |

**Gate decision: NOT PASSED → Phase 2 remains INCOMPLETE.**

---

## 11. Placement rule (post-audit)

1. Do **not** claim “Phase 2 COMPLETE” in releases, marketing, or Phase 3 kickoff decks.  
2. Phase 3 kickoff may begin **design** for Fee / portals only with explicit dependency on P2-P0-* .  
3. Every ops PR continues to cite **workflow ID(s)** + engine + AuthZ + notify + AI.  
4. Update this file when a re-audit flips the production gate.

---

*Companion: MASTER §54 · Phase 1 audit [`phase-1-implementation-audit.md`](../architecture/phase-1-implementation-audit.md) · Workflows [`daily-workflows.md`](daily-workflows.md).*
