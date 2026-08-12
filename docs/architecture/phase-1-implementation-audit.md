# FeezypayERP — Phase 1 Implementation Audit

> **Role:** Implementation / production-readiness review  
> **Date:** 2026-08-07  
> **Status:** Phase 1 engines **SHIPPED** · Production gate **NOT PASSED** · Phase 1 **not marked COMPLETE**  
> **Scope:** MASTER §§28–39 · `docs/architecture/*` Phase 1 engine docs · migrations `20260807120000`–`20260807220000` · `lib/{config,calendar,departments,houses-clubs,subjects,timetable,assessment,report-cards,policies,communications,editing,config-dashboard}` · minimal UIs · onboarding rewires  
> **Verdict:** Configuration backends are strong for **school_admin-only** continued development. **Do not treat as production-ready** until P0 blockers below are closed. Marks / PDF / send correctly deferred.

---

## 1. Phase 1 deliverables (accepted as shipped)

| § | Deliverable | Module | Migration | UI | Smoke |
|---|-------------|--------|-----------|-----|-------|
| 28 | Configuration Engine | `lib/config/` | `…120000` | onboarding | §15.9+ |
| 29 | Academic Calendar | `lib/calendar/` | `…130000` | `/dashboard/calendar` | §15.10 |
| 30 | Department Engine | `lib/departments/` | `…140000` | backend only | §15.11 |
| 31 | House & Club Engine | `lib/houses-clubs/` | `…150000` | `/dashboard/houses-clubs` | §15.12 |
| 32 | Subject Configuration | `lib/subjects/` | `…160000` | onboarding | §15.13 |
| 33 | Timetable Configuration | `lib/timetable/` | `…170000` | onboarding | §15.14 |
| 34 | Assessment Configuration | `lib/assessment/` | `…180000` | backend only | §15.15 |
| 35 | Report Card Templates | `lib/report-cards/` | `…190000` | backend only | §15.16 |
| 36 | School Policy | `lib/policies/` | `…200000` | backend only | §15.17 |
| 37 | Communication Config | `lib/communications/` | `…210000` | backend only | §15.18 |
| 38 | Editing Framework | `lib/editing/` | `…220000` | none | §15.19 |
| 39 | Configuration Dashboard | `lib/config-dashboard/` | none | `/dashboard/configuration` | §15.20 |

**Out of Phase 1 scope (correctly deferred):** marks entry, PDF render, message sending, membership RLS, invites/F11, event outbox, Fee engine, year rollover playbook, multi-persona portals.

---

## 2. Executive verdict

| Gate | Result |
|------|--------|
| Architecture contracts exist | PASS (Phase 0.5) |
| Engines O–Z implemented (backend-first) | PASS |
| Pure validation smokes | PASS (§15.10–§15.20) |
| Archive-first catalogs | PASS (with exceptions — P0) |
| School-scoped auth on actions | PASS (admin-only assumption) |
| Editing framework adopted school-wide | **FAIL** |
| Production multi-tenant integrity | **FAIL** |
| Production multi-persona AuthZ | **FAIL** (known; profiles-only) |
| UI parity across modules | **FAIL** (intentional minimal; uneven) |

**Phase 1 is not marked COMPLETE.** Engines are shipped for continued admin-only build; production hardening is a separate gate.

---

## 3. What’s solid

1. **Archive + partial unique indexes** on active catalogs (subjects, houses, clubs, departments, years, templates, policies, etc.).
2. **DELETE revoked** on core catalogs (subjects/houses/clubs/departments/academic_years/exam_definitions/schedules) and most new config tables.
3. **School-scoped RLS** via `profiles.school_id`; anon revoked on Phase 1 tables.
4. **Server actions** consistently use `getAuthenticatedSchoolContext` + ownership helpers.
5. **Pure validators** per engine; timetable conflict detection; report-card draft immutability; policy/comms version shapes.
6. **Future-scope hygiene:** assessment has no marks storage; report cards no PDF pipeline; communications never send; digital signature stubs.
7. **Versioned documents** shaped correctly (grading scales, policies, message templates, report card templates) with `is_current` uniques.
8. **Membership dating** (`joined_on` / `left_on`) + head/captain uniqueness.
9. **Configuration Dashboard** honestly reports `backend_only`, missing config, and unused audit paths.
10. **Clear FUTURE stubs** with comments (points ledger, textbooks, render jobs, automations/campaigns).

---

## 4. Findings by severity

### CRITICAL — production blockers

| ID | Area | Finding |
|----|------|---------|
| C1 | Permissions | Tenant AuthZ is **profile `school_id` only**. Any authenticated school profile can mutate all config. Blocks multi-persona production (also §26 / F11 / membership RLS P0). |
| C2 | Schema / RLS | **Cross-school FK binding** often unchecked in DB: e.g. report-card assessment/scope FKs, exam schedule subject/class, calendar `term_id` vs year, grading_scale_version on exams, grid year vs `school_id`. App helpers mitigate many paths; RLS alone does not. |
| C3 | Server actions | **Onboarding exam save** mass-archives all year exam definitions then recreates — no publish/lock/dependency evaluation (`lib/onboarding/exams-review-actions.ts`). |
| C4 | Server actions | **Hard deletes** bypass archive contract: `class-subjects-actions` wipe-replace; onboarding `timetable-actions` deletes periods/slots; staff resync deletes `employment_subjects`. |

### HIGH

| ID | Area | Finding |
|----|------|---------|
| H1 | Schema | Archive-only incomplete: DELETE still granted on `terms`, `period_definitions`, `timetable_slots`, `school_working_day_patterns`, `timetable_cycle_days`. |
| H2 | Schema | Dual year lifecycle (`is_active` vs `status` vs `archived_at`) unconstrained — can diverge. |
| H3 | Schema | Year child FKs inconsistent: holidays/events **RESTRICT** vs grids/policies/availability **CASCADE**. |
| H4 | Schema | Version rows (`is_immutable` / published) remain UPDATEable — no DB trigger blocking mutate. |
| H5 | Config | Seed catalogs (exam types, boards, policy kinds, comm priorities) are **migration-time only** — new schools after migrate get empty defaults. |
| H6 | Audit | `audit_entries.school_id ON DELETE CASCADE` wipes compliance history on tenant delete. |
| H7 | Normalization | Dual sources of truth: `subjects.type`/`category`; `class_subjects.is_elective` vs subject; employment `department_id`/`is_hod` vs `department_memberships`; `admissions.house_id` vs `house_memberships`; textbook columns vs stub table. |
| H8 | Editing | Framework adopted only on **subjects + grading scales** (+ generic `lib/editing/actions`). Calendar, departments, houses-clubs, timetable, assessment, report-cards, policies, communications do **not** call `evaluateConfigEdit` / `recordConfigMutation`. |
| H9 | Assessment | Published exams editable; unlock has no elevated role check; registry immutability not enforced in validation. |
| H10 | Dual APIs | Houses/clubs and subjects expose both `lib/config/*` and richer engines without shared evaluate path — drift risk. |
| H11 | Calendar | Event approval / year activate close other years without role, audit, or dependency checks. |

### MEDIUM

| ID | Area | Finding |
|----|------|---------|
| M1 | Migrations | Mostly non-idempotent (`create table` / `create policy` without `if not exists`). |
| M2 | Migrations | Subject code backfill can collide when creating unique indexes on dirty data. |
| M3 | Schema | Incomplete FK harden: `timetable_slots.subject_id` SET NULL; `exam_subject_schedules` → exam still CASCADE from base. |
| M4 | Performance | Unbounded `list*` queries (no pagination); N+1 loops in class-subjects replace, block reorder, membership role ends. |
| M5 | Performance | RLS correlated `profiles` subquery on every policy — fine small-scale; needs membership helper / JWT claim at scale. |
| M6 | Validation | Year create: label-only; FUTURE policy kinds accept loose JSON; automation/campaign validators thin (intentional). |
| M7 | Stubs | Slimmed 2026-08-13: dropped unused `house_point_ledger` / textbooks / substitutions / `teacher_subject_assignments`; keep automations/campaigns / rooms. |
| M8 | Terms | `archived_at` added but DELETE still allowed; exclusion may still apply to archived rows. |
| M9 | Atomicity | Wipe-replace paths lack DB transactions → mid-failure empty state. |

### LOW

| ID | Area | Finding |
|----|------|---------|
| L1 | Schema | Few `updated_at` triggers on Phase 1 catalogs. |
| L2 | Naming | `timetable_slots.teacher_id` → employments (correct FK, confusing name). |
| L3 | Media | `uuid[]` / unbound media ids until Media engine. |
| L4 | Editing | `exam_definition` `schoolScoped: false` in registry while ownership is via year. |
| L5 | UI | Deprecated join/leave club aliases still exposed. |

---

## 5. Audit dimensions (summary)

### 5.1 Schema

Archive-first catalogs and versioned documents are well shaped. Gaps: dual year lifecycle, CASCADE vs RESTRICT inconsistency, incomplete DELETE revocation, mutable “immutable” versions, denormalized dual SoTs.

### 5.2 Indexes

Strong partial uniques and conflict-supporting timetable indexes. Weak/missing on stub tables (ledger, textbooks, render jobs, substitutions).

### 5.3 RLS

Consistent school_id pattern for admin tenancy. Insufficient for multi-persona; insufficient for same-school FK integrity (C2).

### 5.4 Server actions

Auth + school ownership generally solid. Dangerous exceptions: onboarding hard deletes / exam mass-archive; year activate; sparse actor/audit columns outside richer engines.

### 5.5 Validation

Pure modules + smokes are the Phase 1 strength. Gaps: year lifecycle, published-exam immutability, FUTURE policy JSON, editing evaluate not wired.

### 5.6 Performance

Adequate for small schools / onboarding. Unbounded lists and N+1 writes will hurt large timetable / membership schools.

### 5.7 Dependencies

Engine ownership mostly respected. Dual APIs (`lib/config` vs domain engines) and onboarding orchestrator still couple wipe-replace to tables owned by newer engines.

### 5.8 Future compatibility

Marks/PDF/send correctly excluded. Stubs are schema-forward. Risk: enabling stubs later without AuthZ/send gates; mass-archive exams destroys stable IDs needed by report cards.

### 5.9 Missing configuration

Dashboard correctly flags empty years/terms/subjects/policies/templates. New schools lack seeded exam types / boards / policy shells / comm priorities (H5). Many modules `backend_only` with no admin UI.

### 5.10 UI inconsistencies

| Surface | State |
|---------|--------|
| Configuration dashboard | Command centre — links mix real UIs, onboarding, and `#anchors` |
| Calendar / houses-clubs | Minimal admin clients — shared shell, different form density |
| Departments, assessment, report cards, policies, communications, grading scales, subjects (dashboard) | **No dedicated dashboard UI** |
| Nav | Configuration / Calendar / Houses & clubs unlocked; other product nav locked until onboarding complete |
| Visual language | Matches Feezypay dashboard shell; not a full design system for config CRUD |

---

## 6. Migration risks

1. Re-running Phase 1 migrations fails (non-idempotent creates).
2. Subject code backfill + unique index on dirty DB.
3. Timetable grid backfill attaching all slots to primary grid may surprise multi-grid futures.
4. Department HOD backfill demotes extra HODs to `member`.
5. CASCADE year delete can wipe policies/grids while holidays block year delete — asymmetric rollover story.
6. Uncommitted working tree vs remote `main` — apply via `npx supabase db push` before production cutover.

---

## 7. P0 hardening backlog (must close before “production-ready”)

1. **Same-school / same-year FK guards** (triggers or CHECK) for report-card links, exam schedules, calendar terms, scale versions, grid↔year↔school.
2. **Revoke DELETE** (or force archive) on `terms`, `period_definitions`, `timetable_slots`; decide cycle days / working patterns.
3. **Single academic-year lifecycle** model; align activate/close with audit + evaluate.
4. **Align year child ON DELETE** policy with rollover playbook.
5. **Immutable version triggers** (or revoke UPDATE) for grading/policy/template/comm versions.
6. **Seed-on-school-create** for types/boards/policy shells/comm defaults.
7. **Audit retention** — do not CASCADE-wipe `audit_entries` with school (or archive-first).
8. **Remove/harden hard-delete & exam mass-archive** onboarding paths; use archive + soft-migration.
9. **Adopt editing framework** on lifecycle mutations across remaining engines.
10. **Membership RLS + app RBAC** before any non-admin persona (existing §26 P0 / F11).

P1 (scale / UX): pagination on lists; transactional wipe-replace; deepen module UIs; collapse dual config APIs; normalize dual SoTs.

---

## 8. Explicit non-goals of this audit

- No new features implemented.
- No production deploy performed.
- Smokes remain pure validation — they do **not** prove tenant FK integrity, DELETE grants, or migration failure under dirty data.

---

## 9. Recommendation

| Question | Answer |
|----------|--------|
| Are Phase 1 engines shipped? | **Yes** (§28–§39) |
| Is Phase 1 production-ready? | **No** |
| Mark Phase 1 COMPLETE? | **No** — keep status **SHIPPED / production gate open** |
| Safe next work? | Continue admin-only development **or** start P0 hardening backlog above |
| Do not start yet | Fee deep-dive code, WhatsApp/send, portals, year rollover in production |

Canonical follow-ups remain: F11, membership RLS, outbox, Fee design, year rollover (§14 / §26 P0).
