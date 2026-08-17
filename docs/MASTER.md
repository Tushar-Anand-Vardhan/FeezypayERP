# FeezypayERP — Master Technical Document

> **Living document.** Update this file whenever architecture, auth, onboarding, schema, tests, or forward plans change. This is the single source of truth for planning the next phase.
>
> **Last updated:** 2026-08-17 (Onboarding staff/student save: parallel identity + batched writes + deferred invites)  
> **Repo:** `https://github.com/Tushar-Anand-Vardhan/FeezypayERP.git`  
> **Stack:** Next.js 16 · React 19 · Tailwind 4 · Supabase (Auth + Postgres + RLS)  
> **Linked Supabase project:** `xjuudcnexvbtgknbfdfw`  
> **Branch tip at last verification:** `main`  
> **Current phase:** **Use-case Waves 0–6 shipped** (§68). Phase 3 engines through Student Achievement (§67) remain SHIPPED. Cleanup migration `20260807560000_cleanup_unused_stubs.sql`.

---

## Table of contents

1. [How to maintain this document](#1-how-to-maintain-this-document)
2. [Product snapshot](#2-product-snapshot)
3. [Chronology — planned → implemented](#3-chronology--planned--implemented)
4. [Locked product decisions](#4-locked-product-decisions)
5. [Tenancy model](#5-tenancy-model)
6. [Authentication — current (school admin only)](#6-authentication--current-school-admin-only)
7. [Authentication — future (teachers, students, parents) + RBAC](#7-authentication--future-teachers-students-parents--rbac)
8. [Finalized schema](#8-finalized-schema)
9. [Onboarding wizard](#9-onboarding-wizard

10. [Identity matching & Aadhaar](#10-identity-matching--aadhaar)
11. [Staff, students, timetable, exams](#11-staff-students-timetable-exams)
12. [Security, RLS, indexes, cascades](#12-security-rls-indexes-cascades)
13. [Dashboard & routing](#13-dashboard--routing)
14. [Deferred / forward plan map](#14-deferred--forward-plan-map)
15. [Test log (gate checklists executed)](#15-test-log-gate-checklists-executed)
16. [Key file index](#16-key-file-index)
17. [Open deltas & maintenance notes](#17-open-deltas--maintenance-notes)
18. [Phase 0.5 — Business Engines architecture](#18-phase-05--business-engines-architecture)
19. [Phase 0.5 — Domain model](#19-phase-05--domain-model)
20. [Phase 0.5 — System events](#20-phase-05--system-events)
21. [Phase 0.5 — RBAC](#21-phase-05--rbac)
22. [Phase 0.5 — Versioning & editing](#22-phase-05--versioning--editing)
23. [Phase 0.5 — Audit logging](#23-phase-05--audit-logging)
24. [Phase 0.5 — Notification Engine](#24-phase-05--notification-engine)
25. [Phase 0.5 — AI architecture](#25-phase-05--ai-architecture)
26. [Phase 0.5 complete — Architecture review](#26-phase-05-complete--architecture-review)
27. [User journeys](#27-user-journeys)
28. [Phase 1 — Configuration Engine](#28-phase-1--configuration-engine)
29. [Phase 1 — Academic Calendar Engine](#29-phase-1--academic-calendar-engine)
30. [Phase 1 — Department Engine](#30-phase-1--department-engine)
31. [Phase 1 — House & Club Engine](#31-phase-1--house--club-engine)
32. [Phase 1 — Subject Configuration Engine](#32-phase-1--subject-configuration-engine)
33. [Phase 1 — Timetable Configuration Engine](#33-phase-1--timetable-configuration-engine)
34. [Phase 1 — Assessment Configuration Engine](#34-phase-1--assessment-configuration-engine)
35. [Phase 1 — Report Card Template Engine](#35-phase-1--report-card-template-engine)
36. [Phase 1 — School Policy Engine](#36-phase-1--school-policy-engine)
37. [Phase 1 — Communication Configuration Engine](#37-phase-1--communication-configuration-engine)
38. [Phase 1 — Configuration Editing Framework](#38-phase-1--configuration-editing-framework)
39. [Phase 1 — Configuration Dashboard](#39-phase-1--configuration-dashboard)
40. [Phase 1 — Implementation audit](#40-phase-1--implementation-audit)
41. [Phase 2 — Daily operational workflows](#41-phase-2--daily-operational-workflows)
42. [Phase 2 — Student Profile Engine](#42-phase-2--student-profile-engine)
43. [Phase 2 — Teacher Workspace](#43-phase-2--teacher-workspace)
44. [Phase 2 — Attendance Engine](#44-phase-2--attendance-engine)
45. [Phase 2 — Assessment Operations Engine](#45-phase-2--assessment-operations-engine)
46. [Phase 2 — Report Card Engine](#46-phase-2--report-card-engine)
47. [Phase 2 — Event & Activity Engine](#47-phase-2--event--activity-engine)
48. [Phase 2 — Behaviour Engine](#48-phase-2--behaviour-engine)
49. [Phase 2 — Communication Operations Engine](#49-phase-2--communication-operations-engine)
50. [Phase 2 — Homework & Assignment Engine](#50-phase-2--homework--assignment-engine)
51. [Phase 2 — Student Analytics Engine](#51-phase-2--student-analytics-engine)
52. [Phase 2 — Teacher Analytics Engine](#52-phase-2--teacher-analytics-engine)
53. [Phase 2 — Principal Dashboard](#53-phase-2--principal-dashboard)
54. [Phase 2 — Operations audit](#54-phase-2--operations-audit)
55. [Phase 2.5 — Authentication Platform](#55-phase-25--authentication-platform)
56. [Phase 2.6 — Authorization Platform](#56-phase-26--authorization-platform)
57. [Phase 2.7 — Membership Engine](#57-phase-27--membership-engine)
58. [Phase 2.8 — Notification Operations](#58-phase-28--notification-operations)
59. [Phase 2.9 — Teacher Portal](#59-phase-29--teacher-portal)
60. [Phase 2.10 — Student Portal](#60-phase-210--student-portal)
61. [Phase 3 — Curriculum Engine](#61-phase-3--curriculum-engine)
62. [Phase 3 — Assessment Framework Engine](#62-phase-3--assessment-framework-engine)
63. [Phase 3 — Assessment Recording Engine](#63-phase-3--assessment-recording-engine)
64. [Phase 3 — Grade Calculation Engine](#64-phase-3--grade-calculation-engine)
65. [Phase 3 — Report Card Engine](#65-phase-3--report-card-engine)
66. [Phase 3 — Student Observation Engine](#66-phase-3--student-observation-engine)
67. [Phase 3 — Student Achievement Engine](#67-phase-3--student-achievement-engine)
68. [Product use-case roadmap](#68-product-use-case-roadmap)

---

## 1. How to maintain this document

**When to update**

| Event | What to update |
|-------|----------------|
| New migration | §3 chronology, §8 schema, §12 security if RLS/indexes change |
| Auth / invite / RBAC work | §6, §7, §14 |
| Onboarding step change | §9 |
| Gate tests run | Append to §15 with date, step, pass/fail, notes |
| Locked decision changed | §4 — never silently overwrite; add “Superseded” note |
| Deferred item started | Move from §14 into implemented sections; leave trail in chronology |
| New/changed business engine boundary | [`docs/architecture/business-engines.md`](architecture/business-engines.md) + §18 |
| Ownership / column-owner dispute | Architecture §10 matrix first; then engine specs; summarize in §18.3 |
| New/changed domain entity | [`docs/architecture/domain-model.md`](architecture/domain-model.md) + §19 |
| New/changed system event | [`docs/architecture/system-events.md`](architecture/system-events.md) + §20 |
| New/changed RBAC persona or permission | [`docs/architecture/rbac.md`](architecture/rbac.md) + §21 |
| New/changed edit or versioning rule | [`docs/architecture/versioning.md`](architecture/versioning.md) + §22 |
| New/changed audit action or retention | [`docs/architecture/audit-log.md`](architecture/audit-log.md) + §23 |
| New/changed notification type or channel | [`docs/architecture/notification-engine.md`](architecture/notification-engine.md) + §24 |
| New/changed AI service or tool | [`docs/architecture/ai-architecture.md`](architecture/ai-architecture.md) + §25 |
| Architecture review / phase gate | [`docs/architecture/phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md) + §26 |
| Persona journey / UX surface | [`docs/architecture/user-journeys.md`](architecture/user-journeys.md) + §27 |
| Configuration Engine change | [`docs/architecture/configuration-engine.md`](architecture/configuration-engine.md) + §28 + `lib/config/` |
| Academic Calendar Engine change | [`docs/architecture/academic-calendar-engine.md`](architecture/academic-calendar-engine.md) + §29 + `lib/calendar/` |
| Department Engine change | [`docs/architecture/department-engine.md`](architecture/department-engine.md) + §30 + `lib/departments/` |
| House & Club Engine change | [`docs/architecture/house-club-engine.md`](architecture/house-club-engine.md) + §31 + `lib/houses-clubs/` |
| Subject Configuration Engine change | [`docs/architecture/subject-configuration-engine.md`](architecture/subject-configuration-engine.md) + §32 + `lib/subjects/` |
| Timetable Configuration Engine change | [`docs/architecture/timetable-configuration-engine.md`](architecture/timetable-configuration-engine.md) + §33 + `lib/timetable/` |
| Assessment Configuration Engine change | [`docs/architecture/assessment-configuration-engine.md`](architecture/assessment-configuration-engine.md) + §34 + `lib/assessment/` |
| Report Card Template Engine change | [`docs/architecture/report-card-template-engine.md`](architecture/report-card-template-engine.md) + §35 + `lib/report-cards/` |
| School Policy Engine change | [`docs/architecture/school-policy-engine.md`](architecture/school-policy-engine.md) + §36 + `lib/policies/` |
| Communication Configuration Engine change | [`docs/architecture/communication-configuration-engine.md`](architecture/communication-configuration-engine.md) + §37 + `lib/communications/` |
| Configuration Editing Framework change | [`docs/architecture/configuration-editing-framework.md`](architecture/configuration-editing-framework.md) + §38 + `lib/editing/` |
| Configuration Dashboard change | [`docs/architecture/configuration-dashboard.md`](architecture/configuration-dashboard.md) + §39 + `lib/config-dashboard/` |
| Phase 1 implementation audit / production gate | [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md) + §40 |
| Phase 2 daily / routine ops workflow change | [`docs/operations/daily-workflows.md`](operations/daily-workflows.md) + §41 |
| Student Profile Engine change | [`docs/architecture/student-profile-engine.md`](architecture/student-profile-engine.md) + §42 + `lib/student-profile/` |
| Teacher Workspace change | [`docs/architecture/teacher-workspace.md`](architecture/teacher-workspace.md) + §43 + `lib/teacher-workspace/` |
| Attendance Engine change | [`docs/architecture/attendance-engine.md`](architecture/attendance-engine.md) + §44 + `lib/attendance/` |
| Assessment Operations Engine change | [`docs/architecture/assessment-operations-engine.md`](architecture/assessment-operations-engine.md) + §45 + `lib/assessment/` (ops) |
| Report Card Engine change | [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) + §46 + `lib/report-cards/` (issue) |
| Event & Activity Engine change | [`docs/architecture/event-activity-engine.md`](architecture/event-activity-engine.md) + §47 + `lib/events/` |
| Behaviour Engine change | [`docs/architecture/behaviour-engine.md`](architecture/behaviour-engine.md) + §48 + `lib/behaviour/` |
| Communication Operations change | [`docs/architecture/communication-operations-engine.md`](architecture/communication-operations-engine.md) + §49 + `lib/communications/` + `lib/notifications/` |
| Homework & Assignment Engine change | [`docs/architecture/homework-assignment-engine.md`](architecture/homework-assignment-engine.md) + §50 + `lib/homework/` |
| Student Analytics Engine change | [`docs/architecture/student-analytics-engine.md`](architecture/student-analytics-engine.md) + §51 + `lib/student-analytics/` |
| Teacher Analytics Engine change | [`docs/architecture/teacher-analytics-engine.md`](architecture/teacher-analytics-engine.md) + §52 + `lib/teacher-analytics/` |
| Principal Dashboard change | [`docs/architecture/principal-dashboard.md`](architecture/principal-dashboard.md) + §53 + `lib/principal-dashboard/` |
| Phase 2 operations audit / production gate | [`docs/operations/phase2-audit.md`](operations/phase2-audit.md) + §54 |
| Authentication Platform change | [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md) + §55 + `lib/auth/` |
| Authorization Platform change | [`docs/architecture/authorization-platform.md`](architecture/authorization-platform.md) + §56 + `lib/authz/` |
| Membership Engine change | [`docs/architecture/membership-engine.md`](architecture/membership-engine.md) + §57 + `lib/membership/` |
| Notification Operations change | [`docs/architecture/notification-operations.md`](architecture/notification-operations.md) + §58 + `lib/domain-events/` · `lib/notify-orchestration/` |
| Teacher Portal change | [`docs/architecture/teacher-portal.md`](architecture/teacher-portal.md) + §59 + `lib/teacher-portal/` · `components/teacher-portal/` |
| Student Portal change | [`docs/architecture/student-portal.md`](architecture/student-portal.md) + §60 + `lib/student-portal/` · `components/student-portal/` |
| Curriculum Engine change | [`docs/architecture/curriculum-engine.md`](architecture/curriculum-engine.md) + §61 + `lib/curriculum/` |
| Assessment Framework change | [`docs/architecture/assessment-framework-engine.md`](architecture/assessment-framework-engine.md) + §62 + `lib/assessment-framework/` |
| Assessment Recording change | [`docs/architecture/assessment-recording-engine.md`](architecture/assessment-recording-engine.md) + §63 + `lib/assessment-recording/` |
| Grade Calculation change | [`docs/architecture/grade-calculation-engine.md`](architecture/grade-calculation-engine.md) + §64 + `lib/grade-calculation/` |
| Report Card Engine change | [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) + §65 + `lib/report-cards/` |
| Student Observation change | [`docs/architecture/student-observation-engine.md`](architecture/student-observation-engine.md) + §66 + `lib/observations/` |
| Student Achievement change | [`docs/architecture/student-achievement-engine.md`](architecture/student-achievement-engine.md) + §67 + `lib/achievements/` |
| New feature PR | Must name owning engine + entity + events + AuthZ + versioning + audit + notify + AI + persona; **Phase 2+ also cite workflow ID(s)** from §41; respect §26 P0 + §54 P0; update maturity if shipping |

**Conventions**

- Prefer **table / column / file path** names over vague prose.
- Mark status explicitly: `SHIPPED` · `SCHEMA-READY` · `NOT BUILT` · `DEFERRED`.
- Tests go in §15 even if they only re-verified already-shipped work.
- Related short doc: [`docs/deferred-identity-followups.md`](deferred-identity-followups.md) — keep in sync with §14.
- Architecture boundary doc: [`docs/architecture/business-engines.md`](architecture/business-engines.md) — keep in sync with §18.
- Domain model: [`docs/architecture/domain-model.md`](architecture/domain-model.md) — keep in sync with §19.
- Event catalogue: [`docs/architecture/system-events.md`](architecture/system-events.md) — keep in sync with §20.
- RBAC matrix: [`docs/architecture/rbac.md`](architecture/rbac.md) — keep in sync with §21.
- Versioning rules: [`docs/architecture/versioning.md`](architecture/versioning.md) — keep in sync with §22.
- Audit logging: [`docs/architecture/audit-log.md`](architecture/audit-log.md) — keep in sync with §23.
- Notification Engine: [`docs/architecture/notification-engine.md`](architecture/notification-engine.md) — keep in sync with §24.
- AI architecture: [`docs/architecture/ai-architecture.md`](architecture/ai-architecture.md) — keep in sync with §25.
- Phase 0.5 review: [`docs/architecture/phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md) — keep in sync with §26.
- User journeys: [`docs/architecture/user-journeys.md`](architecture/user-journeys.md) — keep in sync with §27.
- Configuration Engine: [`docs/architecture/configuration-engine.md`](architecture/configuration-engine.md) — keep in sync with §28.
- Academic Calendar Engine: [`docs/architecture/academic-calendar-engine.md`](architecture/academic-calendar-engine.md) — keep in sync with §29.
- Department Engine: [`docs/architecture/department-engine.md`](architecture/department-engine.md) — keep in sync with §30.
- House & Club Engine: [`docs/architecture/house-club-engine.md`](architecture/house-club-engine.md) — keep in sync with §31.
- Subject Configuration Engine: [`docs/architecture/subject-configuration-engine.md`](architecture/subject-configuration-engine.md) — keep in sync with §32.
- Timetable Configuration Engine: [`docs/architecture/timetable-configuration-engine.md`](architecture/timetable-configuration-engine.md) — keep in sync with §33.
- Assessment Configuration Engine: [`docs/architecture/assessment-configuration-engine.md`](architecture/assessment-configuration-engine.md) — keep in sync with §34.
- Report Card Template Engine: [`docs/architecture/report-card-template-engine.md`](architecture/report-card-template-engine.md) — keep in sync with §35.
- School Policy Engine: [`docs/architecture/school-policy-engine.md`](architecture/school-policy-engine.md) — keep in sync with §36.
- Communication Configuration Engine: [`docs/architecture/communication-configuration-engine.md`](architecture/communication-configuration-engine.md) — keep in sync with §37.
- Configuration Editing Framework: [`docs/architecture/configuration-editing-framework.md`](architecture/configuration-editing-framework.md) — keep in sync with §38.
- Configuration Dashboard: [`docs/architecture/configuration-dashboard.md`](architecture/configuration-dashboard.md) — keep in sync with §39.
- Phase 1 implementation audit: [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md) — keep in sync with §40.
- Phase 2 daily workflows: [`docs/operations/daily-workflows.md`](operations/daily-workflows.md) — keep in sync with §41.
- Student Profile Engine: [`docs/architecture/student-profile-engine.md`](architecture/student-profile-engine.md) — keep in sync with §42.
- Teacher Workspace: [`docs/architecture/teacher-workspace.md`](architecture/teacher-workspace.md) — keep in sync with §43.
- Attendance Engine: [`docs/architecture/attendance-engine.md`](architecture/attendance-engine.md) — keep in sync with §44.
- Assessment Operations Engine: [`docs/architecture/assessment-operations-engine.md`](architecture/assessment-operations-engine.md) — keep in sync with §45.
- Report Card Engine: [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) — keep in sync with §46.
- Event & Activity Engine: [`docs/architecture/event-activity-engine.md`](architecture/event-activity-engine.md) — keep in sync with §47.
- Behaviour Engine: [`docs/architecture/behaviour-engine.md`](architecture/behaviour-engine.md) — keep in sync with §48.
- Communication Operations Engine: [`docs/architecture/communication-operations-engine.md`](architecture/communication-operations-engine.md) — keep in sync with §49.
- Homework & Assignment Engine: [`docs/architecture/homework-assignment-engine.md`](architecture/homework-assignment-engine.md) — keep in sync with §50.
- Student Analytics Engine: [`docs/architecture/student-analytics-engine.md`](architecture/student-analytics-engine.md) — keep in sync with §51.
- Teacher Analytics Engine: [`docs/architecture/teacher-analytics-engine.md`](architecture/teacher-analytics-engine.md) — keep in sync with §52.
- Principal Dashboard: [`docs/architecture/principal-dashboard.md`](architecture/principal-dashboard.md) — keep in sync with §53.
- Phase 2 operations audit: [`docs/operations/phase2-audit.md`](operations/phase2-audit.md) — keep in sync with §54.
- Authentication Platform: [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md) — keep in sync with §55.
- Authorization Platform: [`docs/architecture/authorization-platform.md`](architecture/authorization-platform.md) — keep in sync with §56.
- Membership Engine: [`docs/architecture/membership-engine.md`](architecture/membership-engine.md) — keep in sync with §57.
- Notification Operations: [`docs/architecture/notification-operations.md`](architecture/notification-operations.md) — keep in sync with §58.
- Teacher Portal: [`docs/architecture/teacher-portal.md`](architecture/teacher-portal.md) — keep in sync with §59.
- Student Portal: [`docs/architecture/student-portal.md`](architecture/student-portal.md) — keep in sync with §60.
- Curriculum Engine: [`docs/architecture/curriculum-engine.md`](architecture/curriculum-engine.md) — keep in sync with §61.
- Assessment Framework Engine: [`docs/architecture/assessment-framework-engine.md`](architecture/assessment-framework-engine.md) — keep in sync with §62.
- Assessment Recording Engine: [`docs/architecture/assessment-recording-engine.md`](architecture/assessment-recording-engine.md) — keep in sync with §63.
- Grade Calculation Engine: [`docs/architecture/grade-calculation-engine.md`](architecture/grade-calculation-engine.md) — keep in sync with §64.
- Report Card Engine (Phase 3): [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) — keep in sync with §65.
- Student Observation Engine: [`docs/architecture/student-observation-engine.md`](architecture/student-observation-engine.md) — keep in sync with §66.
- Student Achievement Engine: [`docs/architecture/student-achievement-engine.md`](architecture/student-achievement-engine.md) — keep in sync with §67.

---

## 2. Product snapshot

**FeezypayERP** is a multi-tenant school ERP. Today the only authenticated product user is the **school administrator**, who:

1. Signs up → automatically gets a new `schools` row + `profiles` row (`role = school_admin`).
2. Completes an 11-step onboarding wizard that configures the school year structure, people, timetable, and exams.
3. Can **Save & exit** to `/dashboard` mid-wizard (features locked until `onboarding_status = completed`).
4. Confirms on **Review** → `schools.onboarding_status = 'completed'`.

Teachers, students, and parents exist as **global identity rows** (`persons` + role profiles) linked to the school via **employment / admission** relationships. They do **not** yet have first-class login portals (`NOT BUILT`; schema is `SCHEMA-READY`).

```text
                    ┌─────────────────────────────────────────┐
                    │         Supabase Auth (auth.users)      │
                    └───────────────────┬─────────────────────┘
                                        │ 1:1 today
                                        ▼
                              profiles (school_admin)
                                        │
                                        ▼
                                     schools
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
   school-scoped                 school links                    school-scoped
   academics                     to global people                ops
   (years, terms,                (employments,                   (timetable,
    classes, sections,            admissions)                     exams)
    subjects, houses…)
                                        │
                                        ▼
                              persons (global humans)
                              ├── teacher_profiles → employments
                              ├── student_profiles → admissions → academic_years
                              └── parent_profiles  → student_parent_links
```

---

## 3. Chronology — planned → implemented

### 3.1 Delivery timeline (git)

| Commit | Theme |
|--------|--------|
| `4e4d9e5` | v1 auth + login |
| `757df20` | Password reset (token_hash / recovery) |
| `bd3cf4d` | School profile + school-level RLS; onboarding step 1 |
| `6b1bcb8` / `6f836b2` | Wizard through subjects |
| `86f378a` | Feezypay light SaaS branding |
| `e61819b` | Onboarding UX polish Steps 1–4 + mid-wizard dashboard |
| `abc1552` | Onboarding expansion: houses → review |
| `b7f540b` | Global Person / Teacher / Student identity |

### 3.2 Planning phases (CreatePlan artifacts)

| Phase | Plan name | Outcome |
|-------|-----------|---------|
| A | **Onboarding UX polish** | Capacity rules, shared wizard footer, dashboard during `in_progress`, board Other, month/day terms |
| B | **Onboarding expansion** | Houses/Clubs, Staff, Students, Timetable, Exams, Review; blocking CSV; `/` → dashboard when signed in |
| C | **Global Identity Architecture** | Phased Steps 0–9; Aadhaar+email match; employment/admission model; login-readiness schema; deferred marketplace/results |
| D | **Phase 0.5 — Business Engines** | Engine catalog E01–E28 + dependency graph |
| E | **Phase 0.5 — Ownership review** | Pairwise conflict analysis, single-owner matrix, event catalog, cycle breakers |
| F | **Phase 0.5 — Domain model** | Major entities, lifecycles, owner engines, Mermaid ER — [`docs/architecture/domain-model.md`](architecture/domain-model.md) |
| G | **Phase 0.5 — System events** | Event-driven contracts: 67 events, producers/consumers/payloads/sync-async — [`docs/architecture/system-events.md`](architecture/system-events.md) |
| H | **Phase 0.5 — RBAC** | Personas, permission keys, engine matrices, RLS vs app — [`docs/architecture/rbac.md`](architecture/rbac.md) |
| I | **Phase 0.5 — Versioning** | Config vs ops mutation rules, entity matrix, dangerous edits — [`docs/architecture/versioning.md`](architecture/versioning.md) |
| J | **Phase 0.5 — Audit logging** | What/who/diff/severity/retention; E28 contract — [`docs/architecture/audit-log.md`](architecture/audit-log.md) |
| K | **Phase 0.5 — Notification Engine** | E19 delivery: types, channels, templates, retry, WhatsApp/email/push/SMS — [`docs/architecture/notification-engine.md`](architecture/notification-engine.md) |
| L | **Phase 0.5 — AI architecture** | E23: services, RAG, tools, persona AIs, never source of truth — [`docs/architecture/ai-architecture.md`](architecture/ai-architecture.md) |
| M | **Phase 0.5 — Architecture review** | CSA review; P0–P2 improvements; **phase complete** — [`docs/architecture/phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md) |
| N | **User journeys** | Admin, Principal, HOD, Teacher, Parent, Student — tasks/engines/data/approvals/notify/AI — [`docs/architecture/user-journeys.md`](architecture/user-journeys.md) |
| O | **Phase 1 — Configuration Engine** | E07 backend: archive/restore, grading scales, `lib/config/` — [`docs/architecture/configuration-engine.md`](architecture/configuration-engine.md) |
| P | **Phase 1 — Academic Calendar Engine** | E08 years/terms/working days/holidays + E17 `calendar_events`; `lib/calendar/`; minimal `/dashboard/calendar` — [`docs/architecture/academic-calendar-engine.md`](architecture/academic-calendar-engine.md) |
| Q | **Phase 1 — Department Engine** | E05 dept surface: memberships, subjects, teaching assignments, announcements, resources, history — [`docs/architecture/department-engine.md`](architecture/department-engine.md) |
| R | **Phase 1 — House & Club Engine** | E07 houses/clubs: colours, logos, TIC, captains, memberships, year scope — [`docs/architecture/house-club-engine.md`](architecture/house-club-engine.md) |
| S | **Phase 1 — Subject Configuration Engine** | E07 subject master: groups, languages, electives, board map, credits, periods, lab, assessment rules, dependencies — [`docs/architecture/subject-configuration-engine.md`](architecture/subject-configuration-engine.md) |
| T | **Phase 1 — Timetable Configuration Engine** | E10 grids, cycle days, slots, availability, locks, conflict detection — [`docs/architecture/timetable-configuration-engine.md`](architecture/timetable-configuration-engine.md) |
| U | **Phase 1 — Assessment Configuration Engine** | E11 config: exam types, categories, weightages, pass marks, components, publish/lock — **no marks** — [`docs/architecture/assessment-configuration-engine.md`](architecture/assessment-configuration-engine.md) |
| V | **Phase 1 — Report Card Template Engine** | E20 templates: boards, scopes, dynamic blocks, assessment refs, signatures — **no PDF** — [`docs/architecture/report-card-template-engine.md`](architecture/report-card-template-engine.md) |
| W | **Phase 1 — School Policy Engine** | E07 versioned policies: attendance, promotion, timings, leave, exam eligibility, grace, behaviour — [`docs/architecture/school-policy-engine.md`](architecture/school-policy-engine.md) |
| X | **Phase 1 — Communication Configuration Engine** | E18 categories, channel templates, priorities, audiences, delivery/approval rules — **no sending** — [`docs/architecture/communication-configuration-engine.md`](architecture/communication-configuration-engine.md) |
| Y | **Phase 1 — Configuration Editing Framework** | Shared edit/archive/restore/duplicate/history/audit/version/deps/soft-migration — [`docs/architecture/configuration-editing-framework.md`](architecture/configuration-editing-framework.md) |
| Z | **Phase 1 — Configuration Dashboard** | School setup command centre: completion, warnings, missing, deps, health + module links — [`docs/architecture/configuration-dashboard.md`](architecture/configuration-dashboard.md) |
| AA | **Phase 1 — Implementation audit** | Schema/RLS/actions/validation/perf/deps/UI/future-compat review; **production gate NOT PASSED** — [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md) |
| AB | **Phase 2 — Daily workflows** | Post-config ops by persona (Admin→Support); trigger/owner/data/deps/notify/AI — design only — [`docs/operations/daily-workflows.md`](operations/daily-workflows.md) |
| AC | **Phase 2 — Student Profile Engine** | Aggregated student SSOT surface (17 modules); no OLTP duplication; SCHEMA-READY stubs — [`docs/architecture/student-profile-engine.md`](architecture/student-profile-engine.md) |
| AD | **Phase 2 — Teacher Workspace** | Teacher homepage aggregate (timetable, attendance, assessments, homework, announcements, events, reminders, dept notices, AI placeholders) — [`docs/architecture/teacher-workspace.md`](architecture/teacher-workspace.md) |
| AE | **Phase 2 — Attendance Engine** | E12: daily/bulk/leave/late/half-day; sessions approve/lock; corrections; audit; analytics; period FUTURE — [`docs/architecture/attendance-engine.md`](architecture/attendance-engine.md) |
| AF | **Phase 2 — Assessment Operations** | E11 marks: scheduled + teacher-created; bulk/single; remarks; draft/publish/lock; corrections; audit — [`docs/architecture/assessment-operations-engine.md`](architecture/assessment-operations-engine.md) |
| AG | **Phase 2 — Report Card Engine** | E20 issue: assemble from E11/E12/E13/house/club + remarks/promotion; version history; no marks OLTP copy — [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) |
| AH | **Phase 2 — Event & Activity Engine** | E17: calendar-origin activities; staff; participation; attendance; awards; certificates; profile by ref — [`docs/architecture/event-activity-engine.md`](architecture/event-activity-engine.md) |
| AI | **Phase 2 — Behaviour Engine** | E13: positive/disciplinary/warning/commendation/teacher notes; visibility; follow-ups; year filter; analytics — [`docs/architecture/behaviour-engine.md`](architecture/behaviour-engine.md) |
| AJ | **Phase 2 — Communication Operations** | E18 compose (announcements…student notices) + E19 delivery pipe (queue, in_app, receipts, history); providers stubbed — [`docs/architecture/communication-operations-engine.md`](architecture/communication-operations-engine.md) |
| AK | **Phase 2 — Homework & Assignment Engine** | Homework / assignment / project briefs; due/late; attachments; marks; feedback; parent visibility; student submit + AI eval FUTURE — [`docs/architecture/homework-assignment-engine.md`](architecture/homework-assignment-engine.md) |
| AL | **Phase 2 — Student Analytics Engine** | E22 student slice: deterministic aggregates + strengths/weaknesses/risks/progress graphs; no AI — [`docs/architecture/student-analytics-engine.md`](architecture/student-analytics-engine.md) |
| AM | **Phase 2 — Teacher Analytics Engine** | E22 teacher slice: attendance/assessment/homework completion, student performance, workload, classes, department; AI FUTURE — [`docs/architecture/teacher-analytics-engine.md`](architecture/teacher-analytics-engine.md) |
| AN | **Phase 2 — Principal Dashboard** | Data-driven school ops homepage: attendance, performance, events, approvals, report cards, assessments, notifications, health — [`docs/architecture/principal-dashboard.md`](architecture/principal-dashboard.md) |
| AO | **Phase 2 — Operations audit** | Perf/schema/perms/versioning/audit/notify/deps review of §§41–53; **production gate NOT PASSED** — Phase 2 **not COMPLETE** — [`docs/operations/phase2-audit.md`](operations/phase2-audit.md) |
| AP | **Phase 2.5 — Authentication Platform** | F11 split, auth_invites, membership_schools RLS, activate/profile, service-role invite adapter — [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md) |
| AQ | **Phase 2.6 — Authorization Platform** | E03: permission catalog, role bundles, `requirePermission`, custom roles, `<Can>` nav, `has_permission` SQL — [`docs/architecture/authorization-platform.md`](architecture/authorization-platform.md) |
| AR | **Phase 2.7 — Membership Engine** | E29: `school_memberships` index, history, preferences, switch-school, sync hooks — [`docs/architecture/membership-engine.md`](architecture/membership-engine.md) |
| AS | **Phase 2.8 — Notification Operations** | Domain outbox → orchestrator → E19 workers + inbox — [`docs/architecture/notification-operations.md`](architecture/notification-operations.md) |
| AT | **Phase 2.9 — Teacher Portal** | Permission-gated teacher feature routes over engines (attendance, marks, homework, …) — [`docs/architecture/teacher-portal.md`](architecture/teacher-portal.md) |
| AU | **Phase 2.10 — Student Portal** | Read-only self-scoped student routes over student-profile + engines — [`docs/architecture/student-portal.md`](architecture/student-portal.md) |
| AV | **Phase 3 — Curriculum Engine** | E30 year/board/grade/subject packs, hierarchy, publish versions, teacher progress — [`docs/architecture/curriculum-engine.md`](architecture/curriculum-engine.md) |
| AW | **Phase 3 — Assessment Framework Engine** | E31 year×class×subject evaluation plans, categories, formulas, version/clone — [`docs/architecture/assessment-framework-engine.md`](architecture/assessment-framework-engine.md) |
| AX | **Phase 3 — Assessment Recording Engine** | E32 teacher evidence under framework categories; bulk marks; lock; append-only history — [`docs/architecture/assessment-recording-engine.md`](architecture/assessment-recording-engine.md) |
| AY | **Phase 3 — Grade Calculation Engine** | E33 deterministic subject/term/overall results from framework + records — [`docs/architecture/grade-calculation-engine.md`](architecture/grade-calculation-engine.md) |
| AZ | **Phase 3 — Report Card Engine** | E20 template designer + assemble from E33/attendance/behaviour/…; draft/published/locked; field assignments — [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md) |
| BA | **Phase 3 — Student Observation Engine** | E34 append-only structured observations; filters; AI summary stub — [`docs/architecture/student-observation-engine.md`](architecture/student-observation-engine.md) |
| BB | **Phase 3 — Student Achievement Engine** | E35 permanent profile from calendar activities; no event SoT duplication — [`docs/architecture/student-achievement-engine.md`](architecture/student-achievement-engine.md) |

### 3.3 Global Identity Steps 0–9 (gate status)

| Step | Goal | Status |
|------|------|--------|
| 0 | Staff multi-subject CSV + HOD department UX | `SHIPPED` + re-verified |
| 1 | `persons` + global ID sequences + unique email/aadhaar | `SHIPPED` + re-verified |
| 2 | `teacher_profiles` + `teacher_employments` + FK cutover | `SHIPPED` + re-verified |
| 3 | Rewire staff onboarding to match + write employment | `SHIPPED` + re-verified |
| 4 | Student profiles / admissions / academic years / parents | `SHIPPED` + re-verified |
| 5 | Rewire students onboarding to global model | `SHIPPED`; **upsert-by-admission-number fix** in working tree (§17) |
| 6 | Progress / review / timetable cutover; drop legacy tables | `SHIPPED` + re-verified (`tsc` + `next build`) |
| 7 | `profile_completed_at` + `person_roles` (schema only) | `SHIPPED` + re-verified; invite doc expanded |
| 8 | Indexes, cascades, RLS audit, Aadhaar helper docs | `SHIPPED` + re-verified |
| 9 | Deferred follow-ups document | `SHIPPED` as [`deferred-identity-followups.md`](deferred-identity-followups.md) |

---

## 4. Locked product decisions

Do not reverse these without an explicit product decision and a §4 amendment.

| # | Decision | Detail |
|---|----------|--------|
| D1 | Staff passwords / invites | New staff with email → `auth_invites` + service-role invite (§55). Requires `SUPABASE_SERVICE_ROLE_KEY` for live email. |
| D2 | `/` route | Signed in → `/dashboard`. Logged out → marketing landing. |
| D3 | CSV imports | **Block entire import** if any row is invalid (staff & students). |
| D4 | Global match keys | **Aadhaar** (unique when present) + **email** (unique when present). Match order: aadhaar_hash → email. |
| D5 | Aadhaar storage | **SHA-256 of normalized 12 digits** + **last4 for display**. Never plaintext in app tables. |
| D6 | Capacity | Class + section; if class capacity set, sum of section capacities must equal it. |
| D7 | Save & Exit | Goes to `/dashboard` even while `onboarding_status = in_progress`. |
| D8 | Continue | Advances wizard with stricter validation than soft save. |
| D9 | Student bulk UX redesign | **Deferred** — model first (identity), UX later. |
| D10 | Identity history | Employments / admissions / academic years are **append-oriented**; do not wipe global `persons` on school re-save. |
| D11 | UI polish of forms | Explicitly deferred component-by-component (product preference). |
| D12 | Universal identity naming | Product “teacher_master / student_master” = `persons` + role profiles + employment/admission. **Do not** introduce parallel `*_master` tables. |
| D13 | Import formats | **CSV first**; `.xlsx` later via the same importer adapter (`lib/onboarding/csv.ts` pattern). |
| D14 | Student tenancy | At most **one active admission** per student profile across schools (enforce in Wave 4+ writers). |
| D15 | Teacher affiliation | Cannot create/invite employment while another school has an **active** employment — admin must ask teacher to leave / update profile first. |
| D16 | Term count | Term **count** immutable after first academic-year publish; **dates** may change if no conflicting calendar events. |
| D17 | Parent access | Parent portal F10 **SHIPPED** (Wave 6). Guardians use `/dashboard/parent` RO over linked children. |

---

## 5. Tenancy model

### 5.1 What is a tenant?

One row in `public.schools`. All school-scoped data hangs off `school_id` (directly or via `academic_years` / admissions / employments).

### 5.2 How a tenant is born

On `auth.users` **INSERT**, trigger `handle_new_user` (`20260807400000` replaces F11 behavior from `20260731120100`):

1. If `raw_user_meta_data.intent = 'create_school'`: insert `schools` + `profiles (role=school_admin)`.
2. If `intent = 'accept_invite'` (or other): **do not** create a school/profile — app binds `persons.auth_user_id` after login.

**Implication:** `/signup` must pass `intent=create_school` (done). Invites no longer spawn orphan schools.

### 5.3 App school context

Server actions use `requirePermission` / `getAuthenticatedSchoolContext(permission)`:

1. Resolve actor via AuthZ + E29 membership index (`membership_schools` / preferences).
2. Prefer `user_school_preferences.active_school_id` (dual-written with `user_active_context`).
3. Fall back to admin `profiles.school_id`, then first active membership.
4. Return `{ supabase, schoolId, actor }` or an error.

One Auth account may hold memberships at many schools; switching does **not** require a second login (§57).

All onboarding writes must filter by this `schoolId`.

---

## 6. Authentication — current (school admin + AuthN platform)

**Status:** School admin signup/login `SHIPPED`. Phase 2.5 AuthN (§55), Phase 2.6 AuthZ (§56), Phase 2.7 Membership (§57) `SHIPPED`. Parent/student portals still `NOT BUILT`.

Canonical: [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md)

### 6.1 What works today

- `/signup` with `intent=create_school` → school + `profiles.school_admin`
- `/login`, email confirm, password reset
- Invites via `createInviteAction` + service-role adapter (warns if key missing)
- `/invite/accept` binds `persons.auth_user_id`; `/activate/profile` completes first login
- `membership_schools(auth.uid())` tenant RLS; `user_active_context` school/persona switcher
- Staff onboarding creates `auth_invites` for new emailed staff (replaces resetPassword hack)

### 6.2 Still open

- E03 `requirePermission` / role bundles
- Multi-persona portal GA (teacher/parent/student product UIs)
- Live invite email without configuring `SUPABASE_SERVICE_ROLE_KEY`

---

## 7. Authentication — multi-persona + RBAC roadmap

**Status:** AuthN platform `SHIPPED` (§55). RBAC-2 permission matrix still design-only ([`rbac.md`](architecture/rbac.md)).

### 7.1 Schema present

| Piece | Purpose |
|-------|---------|
| `persons.auth_user_id` | Login ↔ global person |
| `persons.profile_completed_at` | First-login gate |
| `person_roles` | Capability classes |
| `teacher_employments.status` / `school_persona` | Staff membership + AuthN persona |
| `auth_invites` / `user_active_context` | Invite + session context |
| `membership_schools()` | Tenant RLS helper |

### 7.2 Invite → first login

See §55 and authentication-platform.md. Staff save wires invites.

### 7.3 F11 (SHIPPED)

`handle_new_user` provisions school + admin **only** when `intent=create_school`. Invite path uses `intent=accept_invite` and does not create a school.

### 7.4 RBAC roadmap

| Phase | Work | Status |
|-------|------|--------|
| RBAC-0 | school_admin via `profiles` | SHIPPED |
| RBAC-1 | Invite + auth bind + first login | **SHIPPED** (§55) |
| RBAC-2 | Permission keys + server guards | **SHIPPED** (§56) |
| RBAC-3…6 | Parent/student portals, multi-role UX polish | NOT BUILT (custom roles SHIPPED in §56) |

---

## 8. Finalized schema

### 8.1 Migration inventory (chronological)

| Migration | Purpose |
|-----------|---------|
| `20260731120000_create_schools_and_profiles.sql` | `schools`, `profiles` |
| `20260731120100_handle_new_user_trigger.sql` | Signup provisioning |
| `20260731120200_profiles_schools_rls.sql` | Tenant RLS |
| `20260731153000_school_identity_and_logos.sql` | Identity fields + logos bucket |
| `20260801100000_academic_years_and_terms.sql` | Years + terms |
| `20260801153000_terms_date_constraints.sql` | Term constraints |
| `20260801160000_create_classes.sql` | Classes |
| `20260801170000_create_sections.sql` | Sections |
| `20260801180000_move_capacity_to_classes.sql` | Capacity on classes |
| `20260801190000_create_subjects.sql` | Subjects + `class_subjects` |
| `20260806140000_schools_board_freetext.sql` | Free-text board |
| `20260806141000_terms_month_day.sql` | Recurring month/day terms |
| `20260806142000_restore_section_capacity.sql` | Dual capacity |
| `20260806150000_houses_and_clubs.sql` | Houses/clubs + skip flags |
| `20260806151000_staff_teachers.sql` | Departments + **legacy** teachers (migrated away) |
| `20260806152000_students_guardians.sql` | **Legacy** students (migrated away) |
| `20260806153000_timetable.sql` | Periods, slots, assignments |
| `20260806154000_exam_definitions.sql` | Exams + subject schedules |
| `20260806155000_onboarding_resume_and_exam_grading.sql` | Resume flags + grading_type |
| `20260806160000_persons_and_global_ids.sql` | Global `persons` |
| `20260806161000_teacher_profiles_employments.sql` | Teacher master + employment |
| `20260806162000_student_profiles_admissions.sql` | Student/parent master |
| `20260806163000_person_roles.sql` | Multi-role |
| `20260806164000_identity_lookup_functions.sql` | Lookup RPCs |
| `20260806165000_drop_legacy_identity_tables.sql` | Drop `*_legacy` |
| `20260806166000_identity_create_helpers.sql` | Create/update RPCs |
| `20260807120000_configuration_engine.sql` | E07 archive/restore, grading scales, club memberships, subject FK RESTRICT |
| `20260807130000_academic_calendar_engine.sql` | E08/E17: year status/archive, working days, holidays, calendar_events |
| `20260807140000_department_engine.sql` | E05: dept enrich, memberships, subjects, assignments, announcements, resources, history |
| `20260807150000_house_club_engine.sql` | E07: house/club enrich, house_memberships, club roles, points/events stubs |
| `20260807160000_subject_configuration_engine.sql` | E07: subject_groups, subject master enrich, dependencies, textbook stub |
| `20260807170000_timetable_configuration_engine.sql` | E10: grids, cycle days, availability, locks, rooms/substitutions stubs |
| `20260807180000_assessment_configuration_engine.sql` | E11 config: exam types, categories, policies, components, publish/lock (no results) |
| `20260807190000_report_card_template_engine.sql` | E20 templates: boards, scopes, blocks, assessment refs, versions, PDF job stub |
| `20260807200000_school_policy_engine.sql` | E07 versioned school policies (attendance…behaviour; fee/transport stubs) |
| `20260807210000_communication_configuration_engine.sql` | E18 categories, templates, priorities, audiences, delivery/approval rules; automation/campaign stubs |
| `20260807220000_configuration_editing_framework.sql` | `audit_entries` + `config_change_history` (E28 minimal + config history) |
| `20260807230000_student_profile_engine.sql` | Student profile SCHEMA-READY ops stubs (attendance later enriched by E12) |
| `20260807240000_teacher_workspace.sql` | `homework_assignments` SCHEMA-READY stub |
| `20260807250000_attendance_engine.sql` | E12: sessions, enriched `attendance_records`, leave, audit log |
| `20260807260000_assessment_operations_engine.sql` | E11 marks: mark sessions, enrich `exam_results`, teacher origin/kinds, audit |
| `20260807270000_report_card_engine.sql` | E20 issue: `report_card_issues` + versions, audit; enrich issued docs / render jobs |
| `20260807280000_event_activity_engine.sql` | E17 ops: staff, enrich participants, house/club on events, audit |
| `20260807290000_behaviour_engine.sql` | E13: enrich `conduct_incidents`, follow-ups, audit |
| `20260807300000_communication_operations_engine.sql` | E18 `comm_messages` + audit; E19 types/deliveries/attempts/outbox |
| `20260807310000_homework_assignment_engine.sql` | Enrich `homework_assignments`; `homework_submissions` + audit |
| `20260807320000_student_analytics_engine.sql` | E22 student snapshots + analytics audit |
| `20260807330000_teacher_analytics_engine.sql` | E22 teacher snapshots + analytics audit |
| `20260807400000_authentication_platform.sql` | F11, auth_invites, user_active_context, membership_schools, RLS cutover |
| `20260807410000_authorization_platform.sql` | authz_* tables, seeds, `has_permission` |
| `20260807420000_membership_engine.sql` | school_memberships, history, preferences, helper rewrite |
| `20260807430000_notification_operations.sql` | domain_event_outbox, notify type seeds, delivery statuses, provider configs |
| `20260807440000_curriculum_engine.sql` | E30 curricula, versions, structure, LOs, progress, audit + AuthZ seeds |
| `20260807450000_assessment_framework_engine.sql` | E31 frameworks, categories, formulas, versions, audit + AuthZ seeds |
| `20260807460000_assessment_recording_engine.sql` | E32 records, append-only marks, coverage, attachments, audit + AuthZ seeds |
| `20260807470000_grade_calculation_engine.sql` | E33 runs, results, grace, optional subjects, exemptions, audit + AuthZ seeds |
| `20260807480000_report_card_engine_phase3.sql` | E20 Phase 3: field assignments, new blocks, published/locked, E33 pin columns, AuthZ fill/lock |
| `20260807490000_student_observation_engine.sql` | E34 categories, append-only observations, AI summary stub, audit + AuthZ |
| `20260807500000_student_achievement_engine.sql` | E35 enrich achievements, AI stub, audit + AuthZ; calendar FK |
| `20260807510000_exam_schedule_marking_window.sql` | `exam_subject_schedules.marking_opens_at` / `marking_closes_at` (Wave 1) |
| `20260814090000_period_kind_and_zero.sql` | `period_kind` teaching/class_teacher/break; `period_number >= 0` |
| `20260814100000_exam_definitions_class_id.sql` | `exam_definitions.class_id` — per-class exam patterns; unique name per class |

**Dropped legacy tables (must stay gone):** `teachers`, `teacher_subjects`, `students`, `guardians`, `student_guardians`, `student_section_enrollments` (+ `*_legacy` intermediates).

### 8.2 Global identity

#### `persons`

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `global_id` | `PER########` via trigger + `person_global_id_seq` |
| `full_name`, `first_name`, `last_name` | |
| `date_of_birth`, `gender` | gender ∈ male/female/other |
| `email` | unique `lower(email)` when not null |
| `phone` | |
| `aadhaar_hash` | unique when not null; SHA-256 hex |
| `aadhaar_last4` | display only |
| `auth_user_id` | unique when not null → `auth.users` |
| `profile_completed_at` | first-login gate |
| `photo_path`, `address` | |

**Never** store school-specific fields on `persons`.

#### Role profiles

| Table | Global ID | Link |
|-------|-----------|------|
| `teacher_profiles` | `TCH########` | `person_id` unique, ON DELETE **RESTRICT** |
| `student_profiles` | `STD########` | `person_id` unique, ON DELETE **RESTRICT**; `blood_group`, `medical_notes` |
| `parent_profiles` | `PAR########` | `person_id` unique, ON DELETE **RESTRICT** |

#### School relationships

| Table | Meaning | Key constraints |
|-------|---------|-----------------|
| `teacher_employments` | Job at a school | `school_id` **CASCADE** on school delete; unique **active** `(school_id, teacher_profile_id)`; status `active\|ended\|invited` |
| `employment_subjects` | Subjects for this employment | FK employment |
| `student_admissions` | Enrollment relationship | `school_id` **CASCADE**; unique admission_number per school; unique **active** `(school_id, student_profile_id)`; status `active\|withdrawn\|alumni\|transferred` |
| `student_academic_years` | Year placement | unique active `(admission_id, academic_year_id)` where `left_on IS NULL`; class/section FKs |
| `student_parent_links` | Parent ↔ student | unique `(student_profile_id, parent_profile_id)` |
| `person_roles` | Capability tags | unique `(person_id, role)` |

```text
persons
  ├─ teacher_profiles ── teacher_employments ── employment_subjects
  ├─ student_profiles ── student_admissions ── student_academic_years
  └─ parent_profiles  ── student_parent_links ── (student_profiles)
```

### 8.3 School-scoped academics & ops

| Table | Scope | Notes |
|-------|-------|-------|
| `schools` | root | identity fields, `academic_year_start_month`, `onboarding_status`, `houses_enabled`/`clubs_enabled`, `houses_clubs_completed`, `timetable_skipped` |
| `academic_years` | `school_id` | `label`, `is_active`, `status` (draft/active/closed), `start_date`/`end_date`, `archived_at` |
| `terms` | year | month/day recurring fields + `archived_at` |
| `school_working_day_patterns` | school (± year) | Mon–Sun instructional flags |
| `holidays` | year | E08 non-instructional ranges; archive-only |
| `calendar_events` | year | E17 occasions; categories, visibility, audience, approval |
| `classes` | year | `capacity`, `display_order` |
| `sections` | class | `capacity`, `class_teacher_id` → **`teacher_employments.id`** |
| `subjects` | school | E07 master: category, group, language, elective, board, credits, weekly_periods, lab, assessment_rules, display_order, archive |
| `subject_groups` | school | E07 grouping catalog |
| `subject_dependencies` | subject | prerequisite / corequisite / recommended (archive to unlink) |
| `class_subjects` | class↔subject | elective flag per class offer map |
| `houses`, `clubs` | school | E07 catalog; colour, logo_path, description, year scope, TIC employment |
| `house_memberships` | house | member/captain/vice_captain ↔ student; dated; syncs `admission.house_id` |
| `club_memberships` | club | member/captain/vice_captain; year-scoped; dated |
| `club_event_links` | club | Club ↔ calendar event (E17) |
| `departments` | school | E05 org unit; code, archive, `created_by`/`updated_by`; never stores teachers |
| `department_memberships` | department | head / coordinator / member ↔ `teacher_employments` |
| `department_subjects` | department | Org links to E07 `subjects` |
| `department_teaching_assignments` | department | Employment↔subject relationships (not E10) |
| `department_announcements` | department | Draft/publish; notify stub |
| `department_resources` | department | Links/notes; media stub |
| `department_history` | department | Append-only edit trail |
| `period_definitions` | year | E10 bell periods; `period_kind` teaching/class_teacher/break; `period_number >= 0`; lock/archive |
| `timetable_grids` | year | primary / alternate / exam / special |
| `timetable_cycle_days` | grid | cycle day labels + weekday mapping |
| `timetable_slots` | section×grid | subject + teacher employment; optional `room_id` |
| `teacher_availability` | employment×year | free/busy blocks |
| `section_availability` | section×year | free/busy blocks |
| `rooms` | school | FUTURE room catalog (FK target for slots) |
| `exam_definitions` | year | optional `class_id`; type/category FKs, weightage, max/pass marks, grading, publish/lock, archive |
| `exam_subject_schedules` | exam | optional subject, component type, pass marks, archive |
| `assessment_exam_types` | school | exam-type catalog + defaults |
| `assessment_categories` | school | category kinds catalog |
| `assessment_policies` | school/year | publish/lock defaults + moderation/AI flags |
| `assessment_components` | exam | theory/practical/internal/project breakdown |
| `report_card_boards` | school | board catalog for templates |
| `report_card_templates` | school | layout flags, board/year/term, PDF/digital stubs |
| `report_card_template_versions` | template | immutable publish snapshots |
| `report_card_template_scopes` | template | class / section applicability |
| `report_card_template_assessments` | template | E11 `exam_definition_id` refs (no marks copy) |
| `report_card_template_blocks` | template | dynamic sections |
| `report_card_template_signatures` | template | signature slots |
| `report_card_render_jobs` | school | FUTURE PDF generation stub |
| `school_policies` | school/year | versioned policy docs by kind |
| `school_policy_versions` | policy | immutable `rules` JSON + `is_current` |
| `comm_announcement_categories` | school | announcement category catalog |
| `comm_priority_levels` | school | priority catalog |
| `comm_audience_groups` | school | audience filter config |
| `comm_message_templates` | school | channel templates (email/WA/SMS/…) |
| `comm_message_template_versions` | template | versioned subject/body |
| `comm_delivery_rules` | school | event → channel/audience/template |
| `comm_approval_rules` | school | approval gates |
| `comm_automations` / `comm_campaigns` | school | FUTURE shells (no send) |
| `audit_entries` | school | E28 append-only audit (config framework) |
| `config_change_history` | school | Config snapshots / diffs / soft-migration notes |
| `curricula` | year×class×subject | E30 curriculum packs (grade = `classes`) |
| `curriculum_versions` | curriculum | Immutable publish snapshots (strategy V) |
| `curriculum_units` / `_chapters` / `_topics` / `_subtopics` | curriculum | Live structure tree |
| `curriculum_learning_outcomes` / `_competencies` / `_outcome_competencies` | curriculum | Outcomes + competencies |
| `curriculum_resources` / `_notes` | curriculum | Shared resources; teacher notes |
| `curriculum_topic_progress` | version×section | Ops progress pins version (strategy A) |
| `curriculum_audit_log` | school | Local high-churn curriculum audit |
| `assessment_frameworks` | year×class×subject | E31 evaluation plans (admin-authored) |
| `assessment_framework_versions` | framework | Immutable publish snapshots (strategy V) |
| `assessment_framework_categories` | framework | Weightage, marks, grade/report mappings, term, visibility |
| `assessment_framework_formulas` / `_formula_parts` | framework | Multi-formula weighted blends |
| `assessment_framework_audit_log` | school | Local framework audit |
| `assessment_records` | category | E32 teacher evidence under E31 categories |
| `assessment_record_marks` | record | Append-only marks (`is_current` / supersede) |
| `assessment_record_topics` / `_outcomes` | record | Curriculum coverage links (E30) |
| `assessment_record_attachments` | record | Attachment metadata |
| `assessment_recording_audit_log` | school | Local recording audit |
| `report_card_template_field_assignments` | template | Teacher fillable narrative fields |
| `student_observation_categories` | school | E34 observation category catalog |
| `student_observations` | student/year | Append-only observation facts |
| `student_observation_ai_summaries` | student/year | FUTURE AI summary queue stub |
| `student_observation_audit_log` | school | Local observation audit |
| `student_achievements` (enriched) | student | E35 permanent achievement profile |
| `student_achievement_ai_summaries` | student | FUTURE AI summary queue stub |
| `student_achievement_audit_log` | school | Local achievement audit |
| `grade_calculation_grace_rules` / `_optional_subjects` / `_exemptions` | school/year | E33 calculation config |
| `grade_calculation_runs` | class/scope | Reproducible compute jobs + input snapshot + fingerprint |
| `grade_calculation_results` | run | Subject / term / overall results (append/supersede) |
| `grade_calculation_audit_log` | school | Local grade-calc audit |

### 8.4 Identity RPCs (SECURITY DEFINER)

| Function | Use |
|----------|-----|
| `find_person_by_identity(email, aadhaar_hash)` | Match aadhaar first, else email |
| `get_teacher_profile_for_person` / `get_student_profile_for_person` | Profile lookup |
| `create_person_record` | Insert person |
| `create_teacher_profile_record` / `create_student_profile_record` / `create_parent_profile_record` | Upsert profile + `person_roles` |
| `update_person_record` | Patch person fields |

Granted to `authenticated`; require `auth.uid()`.

---

## 9. Onboarding wizard

### 9.1 Step order

Defined in `lib/onboarding/steps.ts`. Routed by `app/onboarding/[step]/page.tsx`.

| # | Slug | UI | Actions | Soft-save empty? | Continue requires | Skippable |
|---|------|-----|---------|------------------|-------------------|-----------|
| 1 | `school-identity` | `SchoolIdentityForm` | `app/onboarding/actions.ts` | — | identity + academic year | No |
| 2 | `terms` | `TermsForm` | same | — | ≥1 term | No |
| 3 | `classes` | `ClassesForm` | same | Yes | ≥1 class | No |
| 4 | `sections` | `SectionsForm` | same | Yes | every class has section; capacity sum rules | No |
| 5 | `subjects` | `SubjectsForm` | `subjects-actions.ts` | Yes | ≥1 subject | No |
| 6 | `houses-clubs` | `HousesClubsForm` | `houses-clubs-actions.ts` | — | can leave disabled; sets `houses_clubs_completed` | **Yes** |
| 7 | `staff` | `StaffForm` | `staff-actions.ts` | Yes (blocks wipe if existing) | ≥1 teacher | No |
| 8 | `students` | `StudentsForm` | `students-actions.ts` | Yes (blocks wipe if existing) | ≥1 student | No |
| 9 | `timetable` | `TimetableForm` | `timetable-actions.ts` | — | periods/slots or skip | **Yes** (`timetable_skipped`) |
| 10 | `exams` | `ExamsForm` | `exams-review-actions.ts` | Yes (blocks wipe if existing) | ≥1 exam (any class; not every class) | No |
| 11 | `review` | `ReviewForm` | `exams-review-actions.ts` | — | completeness gates then complete | Confirm |

### 9.2 Wizard chrome

`components/onboarding/wizard-actions.tsx`:

- **Back** → previous step href (omitted on step 1).
- **Save & exit** → `intent=save` → `/dashboard`.
- **Continue** → `intent=next` (stricter) → next step.

Timetable also exposes **Skip for now**. Review has its own finish control → `completeOnboardingAction`.

### 9.3 Resume / progress

`getOnboardingProgress` (`lib/onboarding/progress.ts`) picks the **first incomplete** gate:

1. no `academic_year_start_month` → school-identity  
2. terms &lt; 1 → terms  
3. classes &lt; 1 → classes  
4. sections &lt; 1 → sections  
5. subjects &lt; 1 → subjects  
6. `!houses_clubs_completed` → houses-clubs  
7. active `teacher_employments` &lt; 1 → staff  
8. active `student_admissions` &lt; 1 → students  
9. no periods and `!timetable_skipped` → timetable  
10. exams &lt; 1 → exams  
11. else → review  

`/onboarding` index redirects to `progress.nextHref`.

### 9.4 Completion gates

`completeOnboardingAction` requires:

- counts: classes, sections, subjects, teachers, students, exams ≥ 1  
- timetable configured **or** skipped  
- then sets `schools.onboarding_status = 'completed'`

---

## 10. Identity matching & Aadhaar

### 10.1 Helper

`lib/identity/aadhaar.ts`:

1. Strip non-digits.
2. Require exactly 12 digits.
3. `hash = SHA-256(normalized)` hex; `last4 = slice(-4)`.
4. Never persist plaintext.

### 10.2 Resolve algorithm (staff & students)

1. Hash Aadhaar if provided (ignore masked `********1234` on re-save).
2. `find_person_by_identity(email, aadhaar_hash)` — **aadhaar first**.
3. On hit: conflict if email/aadhaar disagree with stored values → clear error.
4. Reuse or create teacher/student profile.
5. Attach **school** relationship (employment / admission) without deleting the person.

### 10.3 Staff save semantics

- Upsert employment by `teacher_profile_id` for this school.
- Soft-end employments removed from the list (`status=ended`).
- Replace `employment_subjects` for kept employments.
- New emailed staff get `auth_invites` (Auth email sent after the employment batch, not per row).
- Unchanged lists skip the rewrite. Dirty rows resolve identity with bounded concurrency (8); employments, subjects, and memberships are batched.
- **TEMP (revert at invite-first ship):** onboarding staff employments are written as `active` even when emailed (normally `invited`). Flag: `STAFF_ONBOARDING_EMPLOYMENT_STATUS` in `lib/onboarding/staff-actions.ts`.

### 10.4 Student save semantics (intended / fixed)

- Diff by **admission_number** within school.
- Reactivate/update existing admission + current academic year row.
- Insert new admission+year when number is new.
- Soft-withdraw admissions removed from list.
- Never delete `persons`.
- Link primary guardian via parent person/profile + `student_parent_links`.
- Parent Auth invites are best-effort, deduped by email, and sent after the admission batch (not inside the per-student loop).
- Unchanged lists skip the rewrite. Dirty rows run with bounded concurrency; D14 is one query; memberships upsert in bulk.

> **Bug fixed in working tree (2026-08-06):** prior implementation withdrew-all then re-inserted, which collided with unique `(school_id, lower(admission_number))`. See §17.

---

## 11. Staff, students, timetable, exams

### 11.1 Staff CSV

Headers: `full_name,phone,email,aadhaar,employee_code,designation,department,subjects,is_hod`  
Subjects: pipe-separated (`Physics|Chemistry`).  
HOD (`is_hod=true`) **requires** department. Invalid row → **entire import blocked**.

### 11.2 Students CSV

Headers include optional `aadhaar`, class/section, guardian fields.  
Empty Aadhaar allowed. Invalid row → entire import blocked.

### 11.3 Timetable

- Teachers listed from **active `teacher_employments`**.
- `sections.class_teacher_id` and `timetable_slots.teacher_id` reference **employment IDs**.
- Skip stores `schools.timetable_skipped = true`.
- Day structure is custom: each bell has a **name**, start/end, and **educational** flag. Non-educational (lunch/assembly) may leave teacher empty; educational slots take optional subject + teacher. `period_number` may be **0**.
- Per class-section CSV import (D13): required headers `class,section,day,period,subject,teacher`. The **sample CSV is generated from the current day structure** (exact period names, start, end, educational yes/no, then Mon–Sat rows). `period` matches the custom name (numbers still accepted). Subject must match catalog name; teacher is full name or `employee_code` and may be blank. Invalid row → **entire import blocked**. Upload previews into the grid; wizard Save persists all sections.

### 11.4 Exams & review

- `exam_definitions` per academic year **and class** (`class_id` FK). Each class has its own exam list (names unique per class). School-wide rows (`class_id` null) remain valid for legacy / teacher-created assessments.
- Onboarding UI: class chips, edit that class only, optional copy-from another class. Continue still requires ≥1 exam overall; a class may have none.
- Soft-archive on onboarding rewrite (E11; DELETE revoked).
- Assessment Configuration Engine: `lib/assessment/**` — types, categories, policies, components, publish/lock. **No marks entry.**
- Review shows progress counts (employments/admissions, not legacy tables).

---

## 12. Security, RLS, indexes, cascades

### 12.1 RLS pattern

Canonical school scope:

```sql
school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
```

- Direct on tables with `school_id`.
- Nested resources join through year/class/admission.
- `persons`: visible if linked via employment, admission, parent link, **or** `auth_user_id = auth.uid()`.
- **No** global `SELECT` on all persons for school admins.

### 12.2 Indexes (hot paths)

| Index | Purpose |
|-------|---------|
| `teacher_employments_school_status_idx` | Staff list |
| `teacher_employments_active_unique_idx` | One active job per teacher/school |
| `student_admissions_school_status_idx` | Student list |
| `student_admissions_active_unique_idx` | One active admission per profile/school |
| `student_academic_years_active_unique_idx` | One active year row per admission/year |
| `persons_email_unique_idx` / `persons_aadhaar_hash_unique_idx` | Match keys |
| `persons_auth_user_unique_idx` | 1:1 auth attach |

### 12.3 Cascades

| Edge | ON DELETE |
|------|-----------|
| `teacher_employments.school_id` → schools | **CASCADE** |
| `student_admissions.school_id` → schools | **CASCADE** |
| `teacher_profiles.person_id` → persons | **RESTRICT** |
| `student_profiles.person_id` → persons | **RESTRICT** |
| `parent_profiles.person_id` → persons | **RESTRICT** |

**Rule:** deleting a school removes school links; **never** cascade-deletes humans.

### 12.4 Verified EXPLAIN (2026-08-06)

Staff list and student list plans used index scans on `teacher_employments_active_unique_idx` / `student_admissions_active_unique_idx` filtered by `school_id`, then nested loops to profiles/persons.

---

## 13. Dashboard & routing

Dashboard chrome is a **left sidebar** (`AppShell` + `lib/dashboard/nav.ts`), not a top wrap of every link. Groups collapse independently; the rail itself collapses on desktop and becomes a drawer on small screens. Each link still requires its permission key — empty groups are hidden. Onboarding keeps a slim top bar with no app nav.

**Perf (2026-08-17):** Middleware skips the full auth gate on `/dashboard/*` (only runs on auth/onboarding/activate). Profile-completion is checked in the dashboard layout. `createClient`, `resolveActor`, `getAuthBootstrapAction`, and `getAppHeaderAuth` are React `cache()`’d per request. `resolveActor` batches grants/subjects and parallelizes lookups. Auth bootstrap parallelizes reads and skips ensure-admin when an admin membership already exists. Notifications inbox no longer flushes outbox workers on every open.

| Route | Behavior |
|-------|----------|
| `/` | Session → `/dashboard`; else marketing |
| `/dashboard` | Allowed during onboarding; locked feature links + continue banner when incomplete |
| `/dashboard/configuration` | School setup command centre (completion, warnings, deps, health) |
| `/dashboard/teacher` | Teacher workspace homepage (employment picker until teacher login) |
| `/dashboard/principal` | Principal / Admin school ops homepage (data-driven panels) |
| `/dashboard/calendar` | Minimal academic calendar admin |
| `/dashboard/houses-clubs` | Minimal houses/clubs admin |
| `/onboarding` | Resume redirect via progress |
| `/onboarding/[step]` | Step UI |

---

## 14. Deferred / forward plan map

Keep [`deferred-identity-followups.md`](deferred-identity-followups.md) aligned with this table.

| ID | Item | Status | Links to |
|----|------|--------|----------|
| F1 | Student bulk input UX redesign | `DEFERRED` | D9, §9–§11 |
| F2 | Append-only `exam_results` | Backend `SHIPPED` (§45); Teacher Portal marks UI `SHIPPED` (§59) | E11 · `lib/assessment/` ops |
| F3 | Attendance | Backend `SHIPPED` (§44); Teacher Portal UI `SHIPPED` (§59); period FUTURE | E12 · `lib/attendance/` |
| F4 | Behaviour & remarks | Backend `SHIPPED` (§48); Teacher Portal UI `SHIPPED` (§59) | E13 · `lib/behaviour/` |
| F13 | Communication sending | Backend `SHIPPED` (§49); UI `NOT BUILT` (teacher read of messages §59); external providers stubbed | E18/E19 · `lib/communications/` · `lib/notifications/` |
| F14 | Homework & assignments | Backend `SHIPPED` (§50); Teacher Portal UI `SHIPPED` (§59); student self-submit FUTURE | `lib/homework/` |
| F15 | Student analytics | Backend `SHIPPED` (§51); UI `NOT BUILT`; deterministic only (no AI) | E22 · `lib/student-analytics/` |
| F16 | Teacher analytics | Backend `SHIPPED` (§52); UI `NOT BUILT`; AI insights FUTURE | E22 · `lib/teacher-analytics/` |
| F17 | Principal dashboard | Aggregator + minimal UI `SHIPPED` (§53); Principal persona login FUTURE | `lib/principal-dashboard/` |
| F18 | Phase 2 production gate | Audit `SHIPPED` (§54); gate **NOT PASSED** — Phase 2 **not COMPLETE** | [`phase2-audit.md`](operations/phase2-audit.md) |
| F19 | Authentication Platform (AuthN) | `SHIPPED` (§55) | [`authentication-platform.md`](architecture/authentication-platform.md) |
| F20 | Authorization Platform (AuthZ / E03) | `SHIPPED` (§56) | [`authorization-platform.md`](architecture/authorization-platform.md) |
| F21 | Membership Engine (E29) | `SHIPPED` (§57) | [`membership-engine.md`](architecture/membership-engine.md) |
| F22 | Notification Operations (domain → E19) | `SHIPPED` (§58); live providers stubbed | [`notification-operations.md`](architecture/notification-operations.md) |
| F5 | Health records | `DEFERRED` | `student_profiles` |
| F6 | Teacher invite + first-login wizard | `SHIPPED` (AuthN §55); needs `SUPABASE_SERVICE_ROLE_KEY` for live email | §7 · §55 |
| F7 | Teacher marketplace / public profiles | `DEFERRED` | `teacher_profiles` |
| F8 | Transfers & certificates | `DEFERRED` | new admission/employment rows, never overwrite |
| F9 | Full RBAC matrix | Design + runtime evaluator `SHIPPED` (§56 / [`rbac.md`](architecture/rbac.md)); portals still open | §7.4, §21, §56 |
| F10 | Parent portal | `SHIPPED` | Wave 6 · `/dashboard/parent` · [`parent-portal.md`](architecture/parent-portal.md) |
| F23 | Teacher Portal | `SHIPPED` (§59); admin preview + linked teacher employment | [`teacher-portal.md`](architecture/teacher-portal.md) |
| F24 | Student Portal | `SHIPPED` (§60); RO default; admin preview via `?studentProfileId=` | [`student-portal.md`](architecture/student-portal.md) |
| F25 | Curriculum Engine (E30) | Backend `SHIPPED` (§61); HOD/teacher portal UI later; assessment/lesson bind to versions next | [`curriculum-engine.md`](architecture/curriculum-engine.md) |
| F26 | Assessment Framework Engine (E31) | Backend `SHIPPED` (§62); teachers read-only; marks pin framework version next | [`assessment-framework-engine.md`](architecture/assessment-framework-engine.md) |
| F27 | Assessment Recording Engine (E32) | Backend `SHIPPED` (§63); evidence under categories; append-only marks; HOD lock | [`assessment-recording-engine.md`](architecture/assessment-recording-engine.md) |
| F28 | Grade Calculation Engine (E33) | Backend `SHIPPED` (§64); teachers never calculate; auditable reproducible runs | [`grade-calculation-engine.md`](architecture/grade-calculation-engine.md) |
| F29 | Report Card Engine (E20 Phase 3) | Backend `SHIPPED` (§65); assemble from sources; template designer; draft/published/locked | [`report-card-engine.md`](architecture/report-card-engine.md) |
| F30 | Student Observation Engine (E34) | Backend `SHIPPED` (§66); append-only; filters; AI summary stub | [`student-observation-engine.md`](architecture/student-observation-engine.md) |
| F31 | Student Achievement Engine (E35) | Backend `SHIPPED` (§67); calendar-origin permanent profile; timeline + AI stub | [`student-achievement-engine.md`](architecture/student-achievement-engine.md) |
| F11 | Split signup trigger for invited users | `SHIPPED` (§55) | §7.3 · §55 |
| F12 | Onboarding form UI polish | `DEFERRED` | D11 |

---

## 15. Test log (gate checklists executed)

Append new runs at the bottom. Do not delete historical entries.

### 15.1 Local validation script

**Command:** `npx tsx scripts/smoke-identity-validation.ts`  
**Date:** 2026-08-06 (multiple runs during Steps 3–5)

| Check | Result |
|-------|--------|
| Staff CSV headers include aadhaar + subjects + is_hod + department | PASS |
| Pipe-separated multi-subject parse | PASS |
| HOD without department blocked | PASS |
| HOD draft without department blocked | PASS |
| HOD + department + multi-subject OK | PASS |
| Invalid Aadhaar blocked | PASS |
| Aadhaar hash deterministic (dashes vs digits) | PASS |
| Student CSV + optional aadhaar + guardian | PASS |
| Student CSV: one bad row blocks import | PASS |
| Student empty aadhaar allowed | PASS |

### 15.2 Step 2 — Teacher employment schema

**Date:** 2026-08-06 · Live DB `xjuudcnexvbtgknbfdfw`

| Check | Result |
|-------|--------|
| `teacher_profiles` with `TCH…` IDs | PASS |
| `teacher_employments` history + active unique | PASS |
| `employment_subjects` | PASS |
| Legacy `teachers` / `teacher_subjects` absent | PASS |
| `sections.class_teacher_id` → `teacher_employments` | PASS |
| `timetable_slots.teacher_id` → `teacher_employments` | PASS |
| Two active employments same teacher+school blocked | PASS |
| End employment then create new (history) | PASS |
| App code reads employments | PASS |

### 15.3 Step 3 — Staff rewire

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| Fresh teacher → PER + TCH + employment + subjects | PASS |
| Re-save → no duplicate persons/profiles/employments | PASS |
| Same person, second school → second employment | PASS |
| Same email different Aadhaar rejected | PASS |
| CSV multi-subject + HOD department | PASS |
| CSV HOD missing department blocked | PASS |
| Timetable lists via employments | PASS |

### 15.4 Step 4 — Student master schema

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| Admission numbers unique per school | PASS |
| Counts consistent (profiles/admissions/years/parents) | PASS |
| Two active admissions same profile+school blocked | PASS |
| Append second academic-year row keeps history | PASS |
| RLS policies present; transfer scopes via admissions | PASS |
| Legacy student/guardian/enrollment tables dropped | PASS |
| `STD…` / `PAR…` global IDs | PASS |
| Smoke cleanup left no Step4 residue | PASS |

Existing smoke student remained healthy: `SMOKE-ADM-001` → `STD00000001` + `PAR00000001`.

### 15.5 Step 5 — Students rewire

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| Student + guardian graph (PER/STD/admission/year/parent) | PASS |
| Re-save by admission number → no duplicate PER/STD | PASS |
| Duplicate admission_number insert still uniquely rejected (proves upsert required) | PASS |
| Progress counts use active admissions/employments | PASS |
| Code fix: upsert-by-admission-number in `students-actions.ts` | IMPLEMENTED (local) |

### 15.6 Step 6 — Cutover

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| Progress/timetable/review use employment & admission tables | PASS |
| Grep: no app `.from("teachers"|"students")` | PASS |
| Legacy tables null in `to_regclass` | PASS |
| FKs: class teacher, slots, assignments → employments | PASS |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npm run build` | PASS |

Smoke school `Feezypay Academy`: staff 3, students 1, exams 1, `timetable_skipped=true`, `onboarding_status=completed`.

### 15.7 Step 7 — Login readiness schema

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| `persons.auth_user_id`, `profile_completed_at` exist | PASS |
| `person_roles` with role check + unique `(person_id, role)` | PASS |
| Role backfill counts (3 teacher / 1 student / 1 parent) | PASS |
| Self policy includes `auth_user_id = auth.uid()` | PASS |
| Multi-role insert + `profile_completed_at` settable | PASS |
| `auth_user_id` uniqueness | PASS |
| Employment status allows `invited` | PASS |
| Invite flow documented | PASS |

### 15.8 Step 8 — Security & indexing

**Date:** 2026-08-06

| Check | Result |
|-------|--------|
| Required indexes present | PASS |
| EXPLAIN staff/student lists use school indexes | PASS |
| Delete test school → employments gone, persons remain | PASS |
| RLS policies school-scoped; no global persons select | PASS |
| Aadhaar helper documented + hash smoke | PASS |

### 15.9 SQL smoke script

`scripts/smoke-identity-db.sql` — end-to-end identity smoke against school `6385483b-8f79-49fc-9bd4-b19d2cef684a` (create HOD, dup email fail, student+parent, cleanup). Prefer transactional / unique emails when re-running on shared DB.

### 15.10 Phase 1 — Academic Calendar Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-calendar-validation.ts`

| Check | Result |
|-------|--------|
| Working-day pattern requires ≥1 day | PASS |
| Holiday / term date validation | PASS |
| Calendar event category + range validation | PASS |
| Invalid category `holiday` rejected (use E08 holidays table) | PASS |

Also: `npx tsc --noEmit` after calendar module land.

### 15.11 Phase 1 — Department Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-department-validation.ts`

| Check | Result |
|-------|--------|
| Department name required | PASS |
| Membership roles head/coordinator/member | PASS |
| Teaching assignment date validation | PASS |
| Announcement / resource validation | PASS |
| Invalid resource URL scheme rejected | PASS |

### 15.12 Phase 1 — House & Club Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-houses-clubs-validation.ts`

| Check | Result |
|-------|--------|
| Hex colour validation | PASS |
| House/club catalog validation | PASS |
| Membership roles captain/vice_captain/member | PASS |
| House/club code helpers | PASS |

### 15.13 Phase 1 — Subject Configuration Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-subject-validation.ts`

| Check | Result |
|-------|--------|
| Subject group validation | PASS |
| Subject master credits/periods/language validation | PASS |
| Assessment rules (pass ≤ max) | PASS |
| Dependency self-reference blocked | PASS |

### 15.14 Phase 1 — Timetable Configuration Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-timetable-validation.ts`

| Check | Result |
|-------|--------|
| Period time overlap detection | PASS |
| Teacher double-book conflict | PASS |
| Teacher unavailable conflict | PASS |
| Period locked conflict | PASS |
| Batch slot conflict detection | PASS |

### 15.15 Phase 1 — Assessment Configuration Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-assessment-validation.ts`

| Check | Result |
|-------|--------|
| Exam type / category validation | PASS |
| Policy pass-percent bounds | PASS |
| Exam definition weightage/pass marks | PASS |
| Component + schedule validation | PASS |
| Publish/lock JSON + lock gates | PASS |

### 15.16 Phase 1 — Report Card Template Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-report-card-validation.ts`

| Check | Result |
|-------|--------|
| Board / template code helpers | PASS |
| Template / scope / assessment binding validation | PASS |
| Block + signature validation | PASS |
| Layout config round-trip | PASS |
| Draft-only mutability + default blueprint | PASS |

### 15.17 Phase 1 — School Policy Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-policy-validation.ts`

| Check | Result |
|-------|--------|
| Policy kinds inventory (12 + 2 future) | PASS |
| Default rules coverage | PASS |
| Attendance / promotion / timings validation | PASS |
| Leave / late / half-day validation | PASS |
| Exam eligibility / grace / behaviour validation | PASS |
| Version effective-date + merge defaults | PASS |

### 15.18 Phase 1 — Communication Configuration Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-communication-validation.ts`

| Check | Result |
|-------|--------|
| Channel inventory | PASS |
| Category / priority / audience validation | PASS |
| Template + email subject / placeholders | PASS |
| Delivery / approval rule validation | PASS |
| Filter rules JSON round-trip | PASS |

### 15.19 Phase 1 — Configuration Editing Framework

**Date:** 2026-08-07 · `npx tsx scripts/smoke-editing-validation.ts`

| Check | Result |
|-------|--------|
| Registry covers major config entities | PASS |
| Diff / changed-field helpers | PASS |
| Soft-migration recommendations | PASS |
| Immutable / versioned flags | PASS |

### 15.20 Phase 1 — Configuration Dashboard

**Date:** 2026-08-07 · `npx tsx scripts/smoke-config-dashboard-validation.ts`

| Check | Result |
|-------|--------|
| Catalog covers all Phase 1 config modules | PASS |
| Unique module ids + hrefs | PASS |
| Completion / health labels | PASS |

### 15.21 Phase 1 — Implementation audit (production gate)

**Date:** 2026-08-07 · review only (no new features) · [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md)

| Check | Result |
|-------|--------|
| Engines §28–§39 shipped (backend-first) | PASS |
| Pure validation smokes §15.10–§15.20 | PASS |
| Archive-first + school-scoped actions (admin-only) | PASS (with known exceptions) |
| Editing framework adopted across engines | FAIL |
| Same-school FK integrity at DB | FAIL |
| Hard-delete / exam mass-archive paths closed | FAIL |
| Multi-persona AuthZ / membership RLS | FAIL (deferred P0) |
| UI parity across all config modules | FAIL (minimal / uneven by design) |
| **Production gate** | **NOT PASSED** |
| **Mark Phase 1 COMPLETE** | **No** |

### 15.22 Phase 2 — Daily operational workflows (design)

**Date:** 2026-08-07 · review only (no application code) · [`docs/operations/daily-workflows.md`](operations/daily-workflows.md)

| Check | Result |
|-------|--------|
| Architecture audited for post-config ops | PASS |
| Workflows separated by persona (Admin, Pri, VP, HOD, Teacher, Student, Parent, Support) | PASS |
| Each workflow has trigger / owner / create / update / deps / notify / AI | PASS |
| Periodic + system workflows indexed | PASS |
| Implementation deferred until catalogue accepted | PASS |

### 15.23 Phase 2 — Student Profile Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-student-profile-validation.ts`

| Check | Result |
|-------|--------|
| 17 profile modules catalogued | PASS |
| Personal validation | PASS |
| AI summary placeholder (no invented facts) | PASS |
| Aggregation does not own operational facts | PASS (by design) |

### 15.24 Phase 2 — Teacher Workspace

**Date:** 2026-08-07 · `npx tsx scripts/smoke-teacher-workspace-validation.ts`

| Check | Result |
|-------|--------|
| 9 homepage panels catalogued | PASS |
| Date / weekday helpers | PASS |
| AI shortcuts are placeholders only (no hardcoding) | PASS |

### 15.25 Phase 2 — Attendance Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-attendance-validation.ts` · migration `20260807250000` pushed

| Check | Result |
|-------|--------|
| Mark statuses (present/absent/late/half_day/excused/leave) | PASS |
| Daily + bulk validation | PASS |
| Period FUTURE gate | PASS |
| Leave + date range helpers | PASS |
| Teacher edit / visibility rules (approve/lock → parent/student) | PASS |
| `npx tsc --noEmit` | PASS |

### 15.26 Phase 2 — Assessment Operations Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-assessment-ops-validation.ts` · migration `20260807260000` pushed

| Check | Result |
|-------|--------|
| Operational kinds (class_test/project/practical/assignment/oral) | PASS |
| Draft / published / locked + teacher edit until lock | PASS |
| Publish/lock → parent/student visibility | PASS |
| Teacher assessment + single/bulk/correction validation | PASS |
| `npx tsc --noEmit` | PASS |

### 15.27 Phase 2 — Report Card Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-report-card-ops-validation.ts` · migration `20260807270000` pushed

| Check | Result |
|-------|--------|
| Issue / version statuses | PASS |
| Draft regenerate / remarks edit gates | PASS |
| Create / remarks / issue validation | PASS |
| No-duplication contract (`source_refs` pointers only) | PASS |
| `npx tsc --noEmit` | PASS |

### 15.28 Phase 2 — Event & Activity Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-event-activity-validation.ts` · migration `20260807280000` pushed

| Check | Result |
|-------|--------|
| Activity categories on calendar (sports…cultural) | PASS |
| Club/house activity require house/club | PASS |
| Staff / participant / certificate validation | PASS |
| No student event-dump contract | PASS |
| `npx tsc --noEmit` | PASS |

### 15.29 Phase 2 — Behaviour Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-behaviour-validation.ts` · migration `20260807290000` pushed

| Check | Result |
|-------|--------|
| Remark kinds (positive…teacher_note) | PASS |
| Visibility → parent/student flags | PASS |
| Create remark / follow-up / analytics validation | PASS |
| `npx tsc --noEmit` | PASS |

### 15.30 Phase 2 — Communication Operations Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-communication-ops-validation.ts` · migration `20260807300000` pushed

| Check | Result |
|-------|--------|
| Message kinds → notification type codes | PASS |
| Draft / schedule / publish validation | PASS |
| Department / class required fields | PASS |
| Delivery statuses include read receipts | PASS |
| `npx tsc --noEmit` | PASS |

### 15.31 Phase 2 — Homework & Assignment Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-homework-validation.ts` · migration `20260807310000` pushed

| Check | Result |
|-------|--------|
| Assignment kinds (homework/assignment/project) | PASS |
| Create / late-until / due date validation | PASS |
| Late submission computation | PASS |
| Grade / submission validation | PASS |
| `npx tsc --noEmit` | PASS |

### 15.32 Phase 2 — Student Analytics Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-student-analytics-validation.ts` · migration `20260807320000` pushed

| Check | Result |
|-------|--------|
| Threshold constants documented | PASS |
| Generate input validation | PASS |
| Deterministic strengths / risks | PASS |
| Same input → same insights | PASS |
| `npx tsc --noEmit` | PASS |

### 15.33 Phase 2 — Teacher Analytics Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-teacher-analytics-validation.ts` · migration `20260807330000` pushed

| Check | Result |
|-------|--------|
| Threshold constants documented | PASS |
| Generate input validation | PASS |
| Deterministic strengths / risks | PASS |
| AI insights placeholder `not_built` | PASS |
| `npx tsc --noEmit` | PASS |

### 15.34 Phase 2 — Principal Dashboard

**Date:** 2026-08-07 · `npx tsx scripts/smoke-principal-dashboard-validation.ts`

| Check | Result |
|-------|--------|
| 10 panels catalogued with sourceTables | PASS |
| Teacher attendance documents staff FUTURE | PASS |
| Date helpers | PASS |
| `npx tsc --noEmit` | PASS |

### 15.35 Phase 2 — Operations audit (review)

**Date:** 2026-08-07 · review only · [`docs/operations/phase2-audit.md`](operations/phase2-audit.md)

| Check | Result |
|-------|--------|
| §§41–53 deliverable inventory | PASS |
| Ownership / anti-duplication | PASS (with notes) |
| Engine-local audit coverage | PASS (partial vs E28) |
| Ops UI parity | **FAIL** |
| Multi-persona AuthZ / F11 (at audit date) | **FAIL** → later **PASS** (§15.36 / §15.37) |
| Domain → notify chains | **FAIL** |
| Fee / portals / providers | **FAIL** (deferred / stub) |
| Phase 1 gate still open | **FAIL** |
| Production gate / Phase 2 COMPLETE | **NOT PASSED / No** |

### 15.36 Phase 2.5 — Authentication Platform

**Date:** 2026-08-07 · `npx tsx scripts/smoke-auth-membership-validation.ts` · `npx tsx scripts/smoke-auth-invite-validation.ts` · `npx tsc --noEmit`

| Check | Result |
|-------|--------|
| F11 intent split documented + migration | PASS |
| membership / invite validation smokes | PASS |
| `npx tsc --noEmit` | PASS |
| Service role configured in this environment | SKIP (unset — invite send warns) |
| E03 permissions | OUT OF SCOPE (see §15.37) |

### 15.37 Phase 2.6 — Authorization Platform

**Date:** 2026-08-07 · `npx tsx scripts/smoke-authz-catalog-validation.ts` · `npx tsx scripts/smoke-authz-evaluate-validation.ts` · `npx tsx scripts/smoke-authz-action-gate.ts` · `npx tsc --noEmit` · migration `20260807410000` pushed

| Check | Result |
|-------|--------|
| Catalog / bundle / hierarchy smokes | PASS |
| Evaluate + ABAC matrix smokes | PASS |
| Action gate (no bare `getAuthenticatedSchoolContext`) | PASS (84 gated files) |
| `npx tsc --noEmit` | PASS |
| `has_permission` + authz_* migration applied | PASS |

### 15.38 Phase 2.7 — Membership Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-membership-validation.ts` · `npx tsc --noEmit` · migration `20260807420000` pushed

| Check | Result |
|-------|--------|
| Kind / persona / transfer / date smokes | PASS |
| `npx tsc --noEmit` | PASS |
| Membership migration applied | PASS |

### 15.39 Phase 2.8 — Notification Operations

**Date:** 2026-08-07 · notify orchestration / worker / emit-gate smokes · `npx tsc --noEmit` · migration `20260807430000` pushed

| Check | Result |
|-------|--------|
| Event→type map smoke | PASS |
| Worker backoff + stub adapters | PASS |
| Emit-gate (no provider imports in domains) | PASS |
| `npx tsc --noEmit` | PASS |
| Migration applied | PASS |

### 15.40 Phase 2.9 — Teacher Portal

**Date:** 2026-08-07 · `npx tsx scripts/smoke-teacher-portal-validation.ts` · `npx tsc --noEmit`

| Check | Result |
|-------|--------|
| 10 portal areas + nav route map | PASS |
| Permission keys in AuthZ catalog | PASS |
| `npx tsc --noEmit` | PASS |
| Manual: mark attendance / enter marks / create homework (admin preview) | PENDING (ops) |

### 15.41 Phase 2.10 — Student Portal

**Date:** 2026-08-07 · `npx tsx scripts/smoke-student-portal-validation.ts` · `npx tsc --noEmit`

| Check | Result |
|-------|--------|
| 12 portal areas + route map | PASS |
| Permission keys in AuthZ catalog | PASS |
| Write allowlist empty (RO v1) | PASS |
| `npx tsc --noEmit` | PASS |
| Manual: admin preview across tabs with visibleOnly | PENDING (ops) |

### 15.42 Phase 3 — Curriculum Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-curriculum-validation.ts` · `npx tsc --noEmit` · migration `20260807440000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| Hierarchy / order / hours / clone / progress smokes | PASS |
| Permission keys + teacher vs HOD bundle coverage | PASS |
| Snapshot shape round-trip | PASS |
| `npx tsc --noEmit` (curriculum modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.43 Phase 3 — Assessment Framework Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-assessment-framework-validation.ts` · `npx tsc --noEmit` · migration `20260807450000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| Catalog keys + teacher read-only / HOD write | PASS |
| Category marks/weightage + Term 1 formula weights | PASS |
| Clone + snapshot round-trip | PASS |
| `npx tsc --noEmit` (framework modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.44 Phase 3 — Assessment Recording Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-assessment-recording-validation.ts` · `npx tsc --noEmit` · migration `20260807460000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| Catalog keys + teacher create/marks vs lock | PASS |
| Mark max-bounds + bulk validation | PASS |
| Edit-until-locked + append-only invariant | PASS |
| Classwork multi-record scenario shape | PASS |
| `npx tsc --noEmit` (recording modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.45 Phase 3 — Grade Calculation Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-grade-calculation-validation.ts` · `npx tsc --noEmit` · migration `20260807470000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| Catalog keys + teacher read-only / HOD run | PASS |
| Term 1 50/30/20 weighted subject result | PASS |
| Grace + letter grades + overall exclude optional | PASS |
| Fingerprint reproducibility | PASS |
| `npx tsc --noEmit` (grade-calculation modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.46 Phase 3 — Report Card Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-report-card-phase3-validation.ts` · `npx tsc --noEmit` · migration `20260807480000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| AuthZ fill/lock + teacher fill-only | PASS |
| New designer block types + field assignment validation | PASS |
| Draft / published / locked gates | PASS |
| No-duplication source_refs (E33 pins) | PASS |
| Legacy ops smoke still PASS | PASS |
| `npx tsc --noEmit` (report-cards modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.47 Phase 3 — Student Observation Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-student-observation-validation.ts` · `npx tsc --noEmit` · migration `20260807490000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| Catalog keys + teacher record / HOD configure | PASS |
| 11 system categories | PASS |
| Append-only remark invariant | PASS |
| Record / supersede / filter / AI queue validation | PASS |
| `npx tsc --noEmit` (observations modules) | PASS |
| `supabase db push` | PENDING (user request) |


### 15.48 Phase 3 — Student Achievement Engine

**Date:** 2026-08-07 · `npx tsx scripts/smoke-student-achievement-validation.ts` · `npx tsc --noEmit` · migration `20260807500000` (not pushed unless requested)

| Check | Result |
|-------|--------|
| AuthZ record + teacher/HOD/student | PASS |
| Calendar origin + no event SoT duplication | PASS |
| Manual + from-event validation | PASS |
| Filter + AI queue stub | PASS |
| `npx tsc --noEmit` (achievements modules) | PASS |
| `supabase db push` | PENDING (user request) |

### 15.49 Onboarding timetable CSV

**Date:** 2026-08-14 · `npx tsx scripts/smoke-timetable-validation.ts`

| Check | Result |
|-------|--------|
| Headers `class,section,day,period,subject,teacher` | PASS |
| Day aliases Mon–Sat / 1–6 | PASS |
| Teacher match by name or employee_code | PASS |
| Wrong class-section / unknown subject blocked | PASS |
| Sample CSV rows match the admin day structure (name/start/end/educational) | PASS |
| Zero period (`period_number = 0`) allowed | PASS |
| CSV period matches custom name or number | PASS |
| Subject on a non-educational row blocked | PASS |
| Break teacher optional / empty allowed | PASS |

### 15.50 Onboarding per-class exams

**Date:** 2026-08-14 · `npx tsx scripts/smoke-exams-validation.ts`

| Check | Result |
|-------|--------|
| Same exam name allowed on different classes | PASS |
| Duplicate name blocked within a class | PASS |
| Missing class / name / term flagged | PASS |
| Unknown class id rejected | PASS |
| Continue requires ≥1 exam overall | PASS |
| Copy-from class replaces the target class list | PASS |

### 15.51 Dashboard grouped sidebar

**Date:** 2026-08-14 · `npx tsx scripts/smoke-dashboard-nav-validation.ts`

| Check | Result |
|-------|--------|
| All previous top-nav labels present in grouped catalog | PASS |
| Unique item ids | PASS |
| `/dashboard` is not a prefix of other dashboard routes | PASS |
| Groups with no permitted items are hidden | PASS |

### 15.52 Onboarding staff/student bulk save

**Date:** 2026-08-17 · `npx tsx scripts/smoke-staff-dirty-check.ts` · `npx tsx scripts/smoke-student-dirty-check.ts` · `npx tsc --noEmit`

| Check | Result |
|-------|--------|
| Staff unchanged list skips rewrite | PASS |
| Student unchanged list skips rewrite (class alias `6` ≡ `Class 6`) | PASS |
| Identity RPCs stay the writer; saves use concurrency 8 + batched memberships/invites | PASS |
| `npx tsc --noEmit` | PASS |

---

## 16. Key file index

### Auth & routing

- `lib/auth/routing.ts`, `lib/auth/validation.ts`
- `lib/supabase/{client,server,middleware}.ts`
- `middleware.ts`
- `app/(auth)/**`, `app/auth/{confirm,callback}/route.ts`
- `app/page.tsx`, `app/dashboard/page.tsx`
- `app/dashboard/layout.tsx` · `components/dashboard/app-shell.tsx` · `app-sidebar.tsx` · `app-header.tsx`
- `lib/dashboard/nav.ts` · `scripts/smoke-dashboard-nav-validation.ts`

### Onboarding

- `lib/onboarding/steps.ts`, `progress.ts`, `server-context.ts`, `csv.ts`
- `lib/onboarding/*-actions.ts`, `staff.ts`, `students.ts`, `timetable.ts`, `timetable-csv.ts`, `exams.ts`, `parallel.ts`
- `lib/auth/create-invite.ts`
- `scripts/smoke-exams-validation.ts` · `scripts/smoke-staff-dirty-check.ts` · `scripts/smoke-student-dirty-check.ts`
- `components/onboarding/**`
- `app/onboarding/**`

### Identity

- `lib/identity/aadhaar.ts`
- Migrations `20260806160000` … `20260806166000`, `20260807120000`

### Docs & smokes

- `docs/MASTER.md` ← **this file**
- `docs/architecture/business-engines.md` ← engines + ownership
- `docs/architecture/domain-model.md` ← entities + ER
- `docs/architecture/system-events.md` ← event catalogue
- `docs/architecture/rbac.md` ← permissions matrix
- `docs/architecture/versioning.md` ← edit / version rules
- `docs/architecture/audit-log.md` ← audit logging
- `docs/architecture/notification-engine.md` ← notification delivery
- `docs/architecture/ai-architecture.md` ← AI layer
- `docs/architecture/phase-05-architecture-review.md` ← Phase 0.5 CSA review (complete)
- `docs/architecture/user-journeys.md` ← persona journeys
- `docs/architecture/configuration-engine.md` ← E07 implementation
- `lib/config/**` ← Configuration Engine module
- `docs/architecture/academic-calendar-engine.md` ← E08+E17 calendar implementation
- `lib/calendar/**` ← Academic Calendar Engine module
- `app/dashboard/calendar/page.tsx` ← minimal calendar admin UI
- `docs/architecture/department-engine.md` ← E05 department surface
- `lib/departments/**` ← Department Engine module
- `docs/architecture/house-club-engine.md` ← E07 house/club surface
- `lib/houses-clubs/**` ← House & Club Engine module
- `app/dashboard/houses-clubs/page.tsx` ← minimal houses/clubs UI
- `docs/deferred-identity-followups.md`
- `scripts/smoke-identity-validation.ts`
- `scripts/smoke-config-validation.ts`
- `scripts/smoke-calendar-validation.ts`
- `scripts/smoke-department-validation.ts`
- `scripts/smoke-houses-clubs-validation.ts`
- `docs/architecture/subject-configuration-engine.md` ← E07 subject master
- `lib/subjects/**` ← Subject Configuration Engine module
- `scripts/smoke-subject-validation.ts`
- `docs/architecture/timetable-configuration-engine.md` ← E10 timetable
- `lib/timetable/**` ← Timetable Configuration Engine module
- `scripts/smoke-timetable-validation.ts`
- `docs/architecture/assessment-configuration-engine.md` ← E11 assessment config
- `lib/assessment/**` ← Assessment Configuration Engine module
- `scripts/smoke-assessment-validation.ts`
- `docs/architecture/report-card-template-engine.md` ← E20 report card templates
- `lib/report-cards/**` ← Report Card Template Engine module
- `scripts/smoke-report-card-validation.ts`
- `docs/architecture/school-policy-engine.md` ← E07 school policies
- `lib/policies/**` ← School Policy Engine module
- `scripts/smoke-policy-validation.ts`
- `docs/architecture/communication-configuration-engine.md` ← E18 communication config
- `lib/communications/**` ← Communication Configuration + Operations module
- `lib/notifications/**` ← E19 Notification delivery pipe
- `docs/architecture/communication-operations-engine.md` ← E18/E19 ops
- `scripts/smoke-communication-validation.ts`
- `docs/architecture/configuration-editing-framework.md` ← shared editing framework
- `lib/editing/**` ← Configuration Editing Framework
- `scripts/smoke-editing-validation.ts`
- `docs/architecture/configuration-dashboard.md` ← school setup command centre
- `lib/config-dashboard/**` ← Configuration Dashboard aggregator
- `app/dashboard/configuration/page.tsx` ← minimal command-centre UI
- `scripts/smoke-config-dashboard-validation.ts`
- `docs/architecture/phase-1-implementation-audit.md` ← Phase 1 production gate audit
- `docs/operations/daily-workflows.md` ← Phase 2 post-config ops by persona
- `docs/operations/phase2-audit.md` ← Phase 2 operations production gate audit
- `docs/architecture/authentication-platform.md` ← Phase 2.5 AuthN platform
- `lib/auth/**` ← AuthN invites, membership, session, activation
- `lib/supabase/admin.ts` ← service-role invite client
- `app/invite/accept/page.tsx` · `app/activate/profile/page.tsx`
- `supabase/migrations/20260807400000_authentication_platform.sql`
- `scripts/smoke-auth-membership-validation.ts` · `scripts/smoke-auth-invite-validation.ts`
- `docs/architecture/authorization-platform.md` ← Phase 2.6 AuthZ platform
- `docs/architecture/rbac.md` ← matrix (runtime via §56)
- `lib/authz/**` ← catalog, bundles, resolve, evaluate, require, Can, custom roles
- `supabase/migrations/20260807410000_authorization_platform.sql`
- `scripts/smoke-authz-catalog-validation.ts` · `smoke-authz-evaluate-validation.ts` · `smoke-authz-action-gate.ts`
- `docs/architecture/membership-engine.md` ← Phase 2.7 Membership Engine (E29)
- `lib/membership/**` ← sync, switch, preferences, transfer
- `supabase/migrations/20260807420000_membership_engine.sql`
- `scripts/smoke-membership-validation.ts`
- `docs/architecture/notification-operations.md` ← Phase 2.8 notify ops platform
- `lib/domain-events/**` · `lib/notify-orchestration/**`
- `lib/notifications/adapters/**` · `process-domain-outbox.ts` · `worker.ts`
- `app/dashboard/notifications/page.tsx` · `app/api/internal/notify-worker/route.ts`
- `supabase/migrations/20260807430000_notification_operations.sql`
- `scripts/smoke-notify-orchestration-validation.ts` · `smoke-notification-worker-validation.ts` · `smoke-notification-emit-gate.ts`
- `docs/architecture/curriculum-engine.md` ← Phase 3 Curriculum Engine (E30)
- `lib/curriculum/**` ← Curriculum Engine module
- `supabase/migrations/20260807440000_curriculum_engine.sql`
- `scripts/smoke-curriculum-validation.ts`
- `docs/architecture/assessment-framework-engine.md` ← Phase 3 Assessment Framework (E31)
- `lib/assessment-framework/**` ← Assessment Framework Engine module
- `supabase/migrations/20260807450000_assessment_framework_engine.sql`
- `scripts/smoke-assessment-framework-validation.ts`
- `docs/architecture/assessment-recording-engine.md` ← Phase 3 Assessment Recording (E32)
- `lib/assessment-recording/**` ← Assessment Recording Engine module
- `supabase/migrations/20260807460000_assessment_recording_engine.sql`
- `scripts/smoke-assessment-recording-validation.ts`
- `docs/architecture/grade-calculation-engine.md` ← Phase 3 Grade Calculation (E33)
- `lib/grade-calculation/**` ← Grade Calculation Engine module
- `supabase/migrations/20260807470000_grade_calculation_engine.sql`
- `scripts/smoke-grade-calculation-validation.ts`
- `docs/architecture/report-card-engine.md` ← Phase 3 Report Card (E20)
- `lib/report-cards/field-assignments-actions.ts` · enhanced `assemble.ts`
- `supabase/migrations/20260807480000_report_card_engine_phase3.sql`
- `scripts/smoke-report-card-phase3-validation.ts`
- `docs/architecture/student-observation-engine.md` ← Phase 3 Student Observation (E34)
- `lib/observations/**` ← Student Observation Engine module
- `supabase/migrations/20260807490000_student_observation_engine.sql`
- `scripts/smoke-student-observation-validation.ts`
- `docs/architecture/student-achievement-engine.md` ← Phase 3 Student Achievement (E35)
- `lib/achievements/**` ← Student Achievement Engine module
- `supabase/migrations/20260807500000_student_achievement_engine.sql`
- `scripts/smoke-student-achievement-validation.ts`
- `docs/architecture/student-profile-engine.md` ← Student Profile aggregator
- `lib/student-profile/**` ← Student Profile Engine module
- `supabase/migrations/20260807230000_student_profile_engine.sql` ← SCHEMA-READY ops stubs
- `scripts/smoke-student-profile-validation.ts`
- `docs/architecture/teacher-workspace.md` ← Teacher homepage aggregate
- `lib/teacher-workspace/**` ← Teacher Workspace module
- `lib/teacher-portal/**` · `components/teacher-portal/**` ← Teacher Portal
- `lib/student-portal/**` · `components/student-portal/**` ← Student Portal
- `app/dashboard/teacher/page.tsx` ← teacher homepage UI
- `docs/architecture/principal-dashboard.md` ← Principal ops homepage
- `lib/principal-dashboard/**` ← Principal Dashboard aggregator
- `app/dashboard/principal/page.tsx` ← principal homepage UI
- `supabase/migrations/20260807240000_teacher_workspace.sql` ← homework stub (enriched §50)
- `docs/architecture/homework-assignment-engine.md` ← Homework & Assignment Engine
- `lib/homework/**` ← Homework & Assignment Engine module
- `scripts/smoke-teacher-workspace-validation.ts`
- `docs/architecture/attendance-engine.md` ← E12 Attendance Engine
- `lib/attendance/**` ← Attendance Engine module
- `supabase/migrations/20260807250000_attendance_engine.sql` ← sessions, leave, audit
- `scripts/smoke-attendance-validation.ts`
- `docs/architecture/assessment-operations-engine.md` ← E11 marks / ops
- `lib/assessment/ops-*.ts` · `results-*.ts` · `mark-session-actions.ts` · `teacher-assessments-actions.ts`
- `supabase/migrations/20260807260000_assessment_operations_engine.sql`
- `scripts/smoke-assessment-ops-validation.ts`
- `docs/architecture/report-card-engine.md` ← E20 report card issue
- `lib/report-cards/assemble.ts` · `issue-*.ts` · `ops-*.ts`
- `supabase/migrations/20260807270000_report_card_engine.sql`
- `scripts/smoke-report-card-ops-validation.ts`
- `docs/architecture/event-activity-engine.md` ← E17 Event & Activity Engine
- `lib/events/**` ← Event & Activity module
- `supabase/migrations/20260807280000_event_activity_engine.sql`
- `scripts/smoke-event-activity-validation.ts`
- `docs/architecture/behaviour-engine.md` ← E13 Behaviour Engine
- `lib/behaviour/**` ← Behaviour Engine module
- `supabase/migrations/20260807290000_behaviour_engine.sql`
- `scripts/smoke-behaviour-validation.ts`
- `scripts/smoke-identity-db.sql`

---

## 17. Open deltas & maintenance notes

### 17.1 Uncommitted at last update (2026-08-07)

| Path | Change |
|------|--------|
| `lib/config/**` | Configuration Engine backend |
| `supabase/migrations/20260807120000_configuration_engine.sql` | Archive, scales, club memberships, FK harden |
| Onboarding subjects/houses/clubs/progress/staff/timetable | Rewired to archive-safe config APIs |
| `docs/architecture/configuration-engine.md` + MASTER §28 | Phase 1 config docs |
| `scripts/smoke-config-validation.ts` | Config validation smoke |
| `lib/calendar/**` | Academic Calendar Engine backend |
| `supabase/migrations/20260807130000_academic_calendar_engine.sql` | Years/terms enrich; working days; holidays; events |
| `app/dashboard/calendar/**` + `components/calendar/**` | Minimal calendar admin UI |
| `docs/architecture/academic-calendar-engine.md` + MASTER §29 | Calendar docs |
| `scripts/smoke-calendar-validation.ts` | Calendar validation smoke |
| `lib/departments/**` | Department Engine backend |
| `supabase/migrations/20260807140000_department_engine.sql` | Memberships, subjects, assignments, announcements, resources, history |
| `docs/architecture/department-engine.md` + MASTER §30 | Department docs |
| `scripts/smoke-department-validation.ts` | Department validation smoke |
| `lib/houses-clubs/**` | House & Club Engine backend |
| `supabase/migrations/20260807150000_house_club_engine.sql` | Catalog enrich, memberships, stubs |
| `app/dashboard/houses-clubs/**` | Minimal houses/clubs UI |
| `docs/architecture/house-club-engine.md` + MASTER §31 | House/club docs |
| `scripts/smoke-houses-clubs-validation.ts` | House/club validation smoke |
| `lib/subjects/**` | Subject Configuration Engine backend |
| `supabase/migrations/20260807160000_subject_configuration_engine.sql` | Subject groups, master enrich, dependencies |
| `docs/architecture/subject-configuration-engine.md` + MASTER §32 | Subject docs |
| `scripts/smoke-subject-validation.ts` | Subject validation smoke |
| `lib/timetable/**` | Timetable Configuration Engine backend |
| `supabase/migrations/20260807170000_timetable_configuration_engine.sql` | Grids, cycle days, availability, locks |
| `docs/architecture/timetable-configuration-engine.md` + MASTER §33 | Timetable docs |
| `scripts/smoke-timetable-validation.ts` | Timetable conflict smoke |
| `lib/assessment/**` | Assessment Configuration Engine backend |
| `supabase/migrations/20260807180000_assessment_configuration_engine.sql` | Types, categories, policies, components, publish/lock |
| `docs/architecture/assessment-configuration-engine.md` + MASTER §34 | Assessment config docs |
| `scripts/smoke-assessment-validation.ts` | Assessment config validation smoke |
| `lib/onboarding/exams-review-actions.ts` + `progress.ts` | Soft-archive exams (DELETE revoked) |
| `lib/report-cards/**` | Report Card Template Engine backend |
| `supabase/migrations/20260807190000_report_card_template_engine.sql` | Boards, templates, scopes, blocks, assessment refs |
| `docs/architecture/report-card-template-engine.md` + MASTER §35 | Report card template docs |
| `scripts/smoke-report-card-validation.ts` | Report card template validation smoke |
| `lib/policies/**` | School Policy Engine backend |
| `supabase/migrations/20260807200000_school_policy_engine.sql` | Versioned policies by kind |
| `docs/architecture/school-policy-engine.md` + MASTER §36 | School policy docs |
| `scripts/smoke-policy-validation.ts` | School policy validation smoke |
| `lib/communications/**` | Communication Configuration Engine backend |
| `supabase/migrations/20260807210000_communication_configuration_engine.sql` | Categories, templates, rules, stubs |
| `docs/architecture/communication-configuration-engine.md` + MASTER §37 | Communication config docs |
| `scripts/smoke-communication-validation.ts` | Communication config validation smoke |
| `lib/communications/` ops + `lib/notifications/**` | Communication Operations + Notification pipe |
| `supabase/migrations/20260807300000_communication_operations_engine.sql` | Messages, deliveries, attempts, outbox |
| `docs/architecture/communication-operations-engine.md` + MASTER §49 | Communication ops docs |
| `scripts/smoke-communication-ops-validation.ts` | Communication ops validation smoke |
| `lib/editing/**` | Configuration Editing Framework |
| `supabase/migrations/20260807220000_configuration_editing_framework.sql` | Audit + config history tables |
| `docs/architecture/configuration-editing-framework.md` + MASTER §38 | Editing framework docs |
| `scripts/smoke-editing-validation.ts` | Editing framework smoke |
| `lib/config/subjects-actions.ts` + `grading-scales-actions.ts` | Reference adopters of framework |
| `lib/config-dashboard/**` | Configuration Dashboard health aggregator |
| `app/dashboard/configuration/**` + `components/configuration/**` | Minimal command-centre UI |
| `docs/architecture/configuration-dashboard.md` + MASTER §39 | Dashboard docs |
| `scripts/smoke-config-dashboard-validation.ts` | Dashboard catalog smoke |
| `components/dashboard/app-header.tsx` | Nav link → Configuration |
| `docs/architecture/phase-1-implementation-audit.md` + MASTER §40 | Production gate audit (not COMPLETE) |
| `docs/operations/daily-workflows.md` + MASTER §41 | Phase 2 daily ops catalogue (design only) |
| `lib/student-profile/**` | Student Profile Engine aggregator |
| `supabase/migrations/20260807230000_student_profile_engine.sql` | Attendance/results/conduct/medical/… stubs |
| `docs/architecture/student-profile-engine.md` + MASTER §42 | Student profile docs |
| `scripts/smoke-student-profile-validation.ts` | Profile catalogue smoke |
| `lib/teacher-workspace/**` | Teacher Workspace aggregator |
| `app/dashboard/teacher/**` + `components/teacher-workspace/**` | Teacher homepage UI |
| `components/teacher-portal/**` + `lib/teacher-portal/**` | Teacher Portal feature clients + nav |
| `supabase/migrations/20260807240000_teacher_workspace.sql` | homework_assignments stub |
| `docs/architecture/teacher-workspace.md` + MASTER §43 | Teacher workspace docs |
| `docs/architecture/teacher-portal.md` + MASTER §59 | Teacher Portal docs |
| `scripts/smoke-teacher-workspace-validation.ts` | Workspace catalogue smoke |
| `scripts/smoke-teacher-portal-validation.ts` | Portal nav/permission catalogue smoke |
| `lib/student-portal/**` + `components/student-portal/**` | Student Portal binders + clients |
| `app/dashboard/student/**` | Student Portal routes |
| `docs/architecture/student-portal.md` + MASTER §60 | Student Portal docs |
| `scripts/smoke-student-portal-validation.ts` | Student portal catalogue smoke |
| `lib/curriculum/**` | Curriculum Engine (E30) backend |
| `supabase/migrations/20260807440000_curriculum_engine.sql` | Packs, versions, structure, progress, AuthZ seeds |
| `docs/architecture/curriculum-engine.md` + MASTER §61 | Curriculum Engine docs |
| `scripts/smoke-curriculum-validation.ts` | Curriculum validation smoke |
| `lib/assessment-framework/**` | Assessment Framework Engine (E31) backend |
| `supabase/migrations/20260807450000_assessment_framework_engine.sql` | Frameworks, categories, formulas, versions, AuthZ seeds |
| `docs/architecture/assessment-framework-engine.md` + MASTER §62 | Assessment Framework docs |
| `scripts/smoke-assessment-framework-validation.ts` | Assessment framework validation smoke |
| `lib/assessment-recording/**` | Assessment Recording Engine (E32) backend |
| `supabase/migrations/20260807460000_assessment_recording_engine.sql` | Records, append-only marks, coverage, attachments, AuthZ |
| `docs/architecture/assessment-recording-engine.md` + MASTER §63 | Assessment Recording docs |
| `scripts/smoke-assessment-recording-validation.ts` | Assessment recording validation smoke |
| `lib/grade-calculation/**` | Grade Calculation Engine (E33) backend |
| `supabase/migrations/20260807470000_grade_calculation_engine.sql` | Runs, results, grace, optional, exemptions, AuthZ |
| `docs/architecture/grade-calculation-engine.md` + MASTER §64 | Grade Calculation docs |
| `scripts/smoke-grade-calculation-validation.ts` | Grade calculation validation smoke |
| `lib/report-cards/field-assignments-actions.ts` · Phase 3 assemble | Report Card Engine Phase 3 |
| `supabase/migrations/20260807480000_report_card_engine_phase3.sql` | Field assignments, lock, E33 pins |
| `docs/architecture/report-card-engine.md` + MASTER §65 | Report Card Phase 3 docs |
| `scripts/smoke-report-card-phase3-validation.ts` | Report card Phase 3 smoke |
| `lib/observations/**` | Student Observation Engine (E34) backend |
| `supabase/migrations/20260807490000_student_observation_engine.sql` | Categories, observations, AI stub, AuthZ |
| `docs/architecture/student-observation-engine.md` + MASTER §66 | Observation docs |
| `scripts/smoke-student-observation-validation.ts` | Observation validation smoke |
| `lib/achievements/**` | Student Achievement Engine (E35) backend |
| `supabase/migrations/20260807500000_student_achievement_engine.sql` | Enrich achievements, AI stub, AuthZ |
| `docs/architecture/student-achievement-engine.md` + MASTER §67 | Achievement docs |
| `scripts/smoke-student-achievement-validation.ts` | Achievement validation smoke |
| `lib/attendance/**` | Attendance Engine backend |
| `supabase/migrations/20260807250000_attendance_engine.sql` | Sessions, leave, audit; enrich records |
| `docs/architecture/attendance-engine.md` + MASTER §44 | Attendance Engine docs |
| `scripts/smoke-attendance-validation.ts` | Attendance validation smoke |
| `lib/student-profile/loaders.ts` | Attendance module reads E12 live columns |
| `lib/assessment/` ops modules | Assessment Operations (marks) backend |
| `supabase/migrations/20260807260000_assessment_operations_engine.sql` | Mark sessions; enrich exam_results; audit |
| `docs/architecture/assessment-operations-engine.md` + MASTER §45 | Assessment ops docs |
| `scripts/smoke-assessment-ops-validation.ts` | Marks validation smoke |
| `lib/report-cards/` issue modules | Report Card Engine (issue/generate) |
| `supabase/migrations/20260807270000_report_card_engine.sql` | Issues, versions, audit |
| `docs/architecture/report-card-engine.md` + MASTER §46 | Report card issue docs |
| `scripts/smoke-report-card-ops-validation.ts` | Report card ops smoke |
| `lib/events/**` | Event & Activity Engine backend |
| `supabase/migrations/20260807280000_event_activity_engine.sql` | Staff + enriched participants |
| `docs/architecture/event-activity-engine.md` + MASTER §47 | Event activity docs |
| `scripts/smoke-event-activity-validation.ts` | Event activity smoke |
| `lib/behaviour/**` | Behaviour Engine backend |
| `supabase/migrations/20260807290000_behaviour_engine.sql` | Remarks enrich + follow-ups + audit |
| `docs/architecture/behaviour-engine.md` + MASTER §48 | Behaviour docs |
| `scripts/smoke-behaviour-validation.ts` | Behaviour validation smoke |
| `lib/communications/` message/query + `lib/notifications/**` | E18 ops + E19 delivery |
| `supabase/migrations/20260807300000_communication_operations_engine.sql` | Messages + notification pipe |
| `docs/architecture/communication-operations-engine.md` + MASTER §49 | Communication ops docs |
| `scripts/smoke-communication-ops-validation.ts` | Communication ops smoke |
| `lib/homework/**` | Homework & Assignment Engine backend |
| `supabase/migrations/20260807310000_homework_assignment_engine.sql` | Enrich homework + submissions |
| `docs/architecture/homework-assignment-engine.md` + MASTER §50 | Homework docs |
| `scripts/smoke-homework-validation.ts` | Homework validation smoke |
| `lib/student-analytics/**` | Student Analytics Engine (E22 student slice) |
| `supabase/migrations/20260807320000_student_analytics_engine.sql` | Snapshots + analytics audit |
| `docs/architecture/student-analytics-engine.md` + MASTER §51 | Student analytics docs |
| `scripts/smoke-student-analytics-validation.ts` | Student analytics smoke |
| `lib/teacher-analytics/**` | Teacher Analytics Engine (E22 teacher slice) |
| `supabase/migrations/20260807330000_teacher_analytics_engine.sql` | Teacher snapshots + audit |
| `docs/architecture/teacher-analytics-engine.md` + MASTER §52 | Teacher analytics docs |
| `scripts/smoke-teacher-analytics-validation.ts` | Teacher analytics smoke |
| `lib/principal-dashboard/**` | Principal Dashboard aggregator |
| `app/dashboard/principal/**` + `components/principal-dashboard/**` | Principal ops UI |
| `docs/architecture/principal-dashboard.md` + MASTER §53 | Principal dashboard docs |
| `scripts/smoke-principal-dashboard-validation.ts` | Principal dashboard smoke |
| `components/dashboard/app-header.tsx` | Nav → Principal |
| `docs/operations/phase2-audit.md` + MASTER §54 | Phase 2 ops production gate (**NOT PASSED**) |

**Action:** Phase 2 **not COMPLETE**. Close §54 P0 (ops UIs, notify chains, F11/membership RLS) before Fee/portal GA; Phase 1 §40 still open.

### 17.2 Smoke data still in linked DB (known)

School `6385483b-8f79-49fc-9bd4-b19d2cef684a` (“Feezypay Academy”) may still contain:

- Teachers: Priya Sharma, Raj Gupta, Smoke HOD (`smoke-hod@feezy.test`)
- Student: `SMOKE-ADM-001` / Smoke Student + Smoke Parent

Safe to keep for manual QA; delete when cleaning staging.

### 17.3 Known product gaps (do not treat as bugs)

- Teacher/parent/student self-login portals
- Real invite + Auth user creation (service role / Invite API)
- `handle_new_user` always creates a school (blocks invited users)
- Login does not honor `?next=`
- Staff `resetPasswordForEmail` cannot create accounts
- Employment `invited` unused by app writes
- Form UI polish deferred
- **Phase 1 production gate open (§40)** — same-school FK guards, DELETE revoke leftovers, editing adoption, seed-on-create, onboarding hard-delete harden, etc.
- **Phase 2 production gate open (§54)** — ops UIs, notify chains, F11, Fee/portals; backends alone are not COMPLETE.

### 17.4 Next planning suggestions

1. Commit §17.1 deltas.  
2. **Phase 0.5 is complete** — treat §18–§27 + architecture docs as binding.  
3. **Phase 1 engines §28–§39 SHIPPED; production gate NOT PASSED (§40)** — do not mark Phase 1 COMPLETE until P0 hardening closes.  
4. **Phase 2 backends §41–§53 SHIPPED; production gate NOT PASSED (§54)** — do **not** mark Phase 2 COMPLETE.  
5. Close **§54 P0** (ops UIs for attendance/marks/report cards; wire absent_alert / results_published / conduct notify; F11 + membership RLS) **or** continue admin-only with explicit risk acceptance.  
6. Close **§40.3 P0** (FK integrity, archive purity, year lifecycle, editing adoption, seeds, audit retention) **or** continue with risk acceptance.  
7. Continue **§26 P0**: F11, membership RLS, outbox, Fee deep-dive, year-rollover — **before** Fee UI, portals, or WhatsApp.  
8. Spec **RBAC-1** teacher invite after F11 + membership RLS.  
9. Implement remaining Phase 2 by **workflow ID** (spine: attendance UI → marks UI → **report card UI** → wire notify → fees → portals).  
10. Refresh `daily-workflows.md` maturity table to match §44–§53 backends (UI/notify/auth still open).  
11. Wire onboarding staff department creates through `lib/departments` + memberships (retire employment-only HOD flags as source of truth).  
12. Prefer `house_memberships` over writing `admission.house_id` alone.  
13. Fix Principal dashboard / comms fan-out N+1 (§54 perf).  
14. Bridge engine-local audits → E28; delivery retry worker (WF-SYS-04).  
15. Assessment **marks UI** shipped for teachers (§59 / WF-TCH-05); HOD/admin publish oversight UI still open.  
16. Report card **PDF media** remains deferred (issue backend §46 / WF-PER-02; DigiLocker later).  
17. Fee / transport **policy runtime** remains deferred until Fee deep-dive + WF-SUP-ACC-*.  
18. Communication **ops backend** shipped (§49); compose UI + real providers still open.  
19. Adopt **§38 editing framework** in remaining config action modules.  
20. Re-audit and mark Phase 1 **COMPLETE** only when §40 production gate PASSes.  
21. Re-audit and mark Phase 2 **COMPLETE** only when §54 production gate PASSes.  
22. Phase 3 (Fee / portals) may **design** with dependency on §54 P0; do not claim Phase 2 COMPLETE in kickoff.  
23. Align Teacher Workspace “pending attendance” with `attendance_sessions` (Teacher Portal attendance UI §59 lands; refine session pending heuristics as needed).  
24. Align Teacher Workspace “pending assessments” with `assessment_mark_sessions` (Teacher Portal marks UI §59 lands; refine pending heuristics as needed).  
25. Parent portal remains open after Teacher (§59) + Student (§60) portals.  
26. Assessment / lesson / report / AI must **reference** `curriculum_version_id` (E30) — do not duplicate chapter trees; bind exam definitions next.  
27. Curriculum HOD/Teacher portal UI and `subjects.chapter_map` migration remain open after §61 backend.  
28. E11 marks / E20 report cards should **pin `assessment_framework_version_id`** (E31); framework admin UI later; teachers never design frameworks.  
29. Prefer **E32** assessment records for teacher evidence under framework categories; migrate Teacher Portal marks UI from E11 teacher-created defs gradually.  
30. Report cards / portals should consume **published E33** grade results (not teacher-entered finals).  
31. Admin template designer UI and PDF/digital signatures remain open after §65 backend.  
32. Observation teacher UI and AI provider wiring remain open after §66 backend.  
33. Achievement teacher UI and AI provider wiring remain open after §67 backend.

---

## 18. Phase 0.5 — Business Engines architecture

**Status:** Design-only (2026-08-06). **No application code, migrations, or schema changes** in this phase.  
**Ownership review:** Complete (same date) — every fact has exactly one owner engine.

**Canonical doc:** [`docs/architecture/business-engines.md`](architecture/business-engines.md)

### 18.1 Why

Before building remaining ERP features (fees, attendance, invites, portals, AI), FeezypayERP needs explicit **engine boundaries** so features do not duplicate data or blur AuthN / Identity / Enrollment / Fee / Notification concerns.

### 18.2 Engine catalog (summary)

| IDs | Plane | Engines |
|-----|-------|---------|
| E01 | Tenancy | Tenancy |
| E02–E03 | Security | Access (AuthN), Authorization (RBAC) |
| E04–E06 | People | Identity, Workforce, Enrollment |
| E07–E10 | Setup | Configuration, Calendar, Structure, Timetable |
| E11–E14 | Academics | Assessment, Attendance, Conduct, Health |
| E15–E16 | Commercial | Fee, Payments (**Feezypay core — not built**) |
| E17–E19 | Engagement | Event, Communication, Notification |
| E20–E23 | Output | Document, Reporting, Analytics, AI |
| E24 | Growth | Marketplace |
| E25–E28 | Cross-cutting | Onboarding, Ingestion, Media, Audit |
| E29 | Membership | Person↔school index |
| E30 | Curriculum | Year/board/grade/subject packs + versions |
| E31 | Assessment Framework | Year×class×subject evaluation plans + formulas |
| E32 | Assessment Recording | Teacher evidence under categories; append-only marks |
| E33 | Grade Calculation | Deterministic subject/term/overall results |
| E20 | Document / Report Cards | Template designer + assemble from sources (Phase 3) |
| E34 | Student Observation | Append-only structured observations |
| E35 | Student Achievement | Permanent profile from calendar activities |

### 18.3 Ownership review (2026-08-06) — outcomes

Full pairwise analysis, matrix, events, and cycle breakers: architecture doc **§§10–14**.

**Hardest conflicts resolved (responsibility moves):**

| Move | Decision |
|------|----------|
| `profiles` | **E01** owns (tenant admin membership); E03 reads |
| `person_roles` | **E04** sole writer; E03 interprets permissions |
| `schools.*` columns | Split: lifecycle **E01**; branding/flags config **E07**; `academic_year_start_month` **E08**; wizard flags **E25** |
| `onboarding_status` | **E01** owns; E25 emits completion |
| Medical fields on `student_profiles` | **E14** column-level owner |
| `departments` | **E05** (not Configuration) |
| Fee heads | **E15** (not Configuration) |
| Who teaches what | **E05** eligibility (`employment_subjects`) vs **E10** schedule (slots/assignments) |
| Holidays vs occasions | **E08** vs **E17** |
| Message vs delivery | **E18** vs **E19** |
| Payment vs ledger | **E16** emits `payment.*`; **E15** posts ledger |
| AI | Suggestions only; OLTP writes stay in owning engines |

**Critical cycles to break before invites/fees:** E01↔E02 signup trigger (F11); E15↔E16 ledger updates; E03 bootstrap without requiring employment.

**Rule for implementers:** Physical table co-location ≠ shared ownership. Consult the ownership matrix before adding columns.

### 18.4 Recommended next design docs (Phase 1 readiness)

1. **F11 signup-trigger split** (P0 #1)  
2. **Membership RLS / AuthZ read model** (P0 #2)  
3. **Outbox + event mediator** (P0 #3)  
4. **Fee Engine deep-dive** — obey versioning (P0 #4)  
5. **Academic year rollover playbook** (P0 #5)  
6. Then P1: RBAC-1, permission keys, teaching-map resolution, AuditEntry, in-app notifications  

Full prioritized list: [`phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md) §13.

### 18.5 Placement rule for all future features

Every feature PR / plan must name:

1. Owning engine (write authority) — must match §10 matrix  
2. Read-only dependency engines  
3. Emitted / consumed events — catalogue names from [`system-events.md`](architecture/system-events.md)  
4. Persona + AuthZ permission keys from [`rbac.md`](architecture/rbac.md)  
5. Mutation strategy from [`versioning.md`](architecture/versioning.md) (past vs future effect)  
6. Audit action + severity from [`audit-log.md`](architecture/audit-log.md)  
7. Notification type + channels (if user-visible alert) from [`notification-engine.md`](architecture/notification-engine.md)  
8. AI service + tools (if assistive) from [`ai-architecture.md`](architecture/ai-architecture.md) — never silent OLTP

If a design creates a second source of truth, reject and redesign.

---

## 19. Phase 0.5 — Domain model

**Status:** Design-only (2026-08-06). **No SQL / migrations / application code** in this deliverable.

**Canonical doc:** [`docs/architecture/domain-model.md`](architecture/domain-model.md)

### 19.1 What it contains

- Catalog of major domain entities (shipped + planned): School, Person, Teacher/Student/Parent profiles, Employment, Admission, Placement, AcademicYear, Term, Subject, Class, Section, House, Club, Timetable, Assessment, Attendance, Fees/Payments, CalendarEvent, Competition, Announcement, Notification, Documents/ReportCard, LessonPlan, and cross-cutting Media/Import/Audit/AI/Marketplace
- Per entity: purpose, relationships, lifecycle, **owner engine**, dependencies, future extensions
- Mermaid ER diagrams (full target + compact shipped spine)
- Cross-cutting invariants aligned with ownership matrix

### 19.2 Key modeling distinctions (do not collapse)

| Do not confuse | Why |
|----------------|-----|
| Person vs TeacherEmployment / StudentAdmission | Global human vs school relationship |
| EmploymentSubject vs TimetableSlot | Eligibility vs schedule |
| Holiday vs CalendarEvent vs Period slot | Calendar closure vs occasion vs bell grid |
| Announcement vs Notification | Content vs delivery |
| AssessmentResult vs ReportCard | Marks truth vs issued artifact |
| Invoice/LedgerEntry vs Payment | Obligation vs provider settlement |

### 19.3 How to use with engines

1. Find the **entity** in the domain model.  
2. Confirm **owner engine** matches business-engines §10.  
3. Implement writes only in that engine’s module; others reference by id.  
4. Emit events using names from [`system-events.md`](architecture/system-events.md) (canonical catalogue).

---

## 20. Phase 0.5 — System events

**Status:** Design-only (2026-08-06). Catalogue is the ERP event contract; **runtime bus not implemented yet**.

**Canonical doc:** [`docs/architecture/system-events.md`](architecture/system-events.md)

### 20.1 Principles

- Engines **must not** tightly couple write paths; they communicate via **events** (+ explicit commands).
- Payloads carry **ids**, not denormalized PII or file bytes.
- Consumers are **idempotent** on `event_id` (at-least-once).
- **Sync** for correctness/gating; **Async** for delivery, PDFs, analytics, AI.

### 20.2 Coverage (examples)

| Human name | Catalogue event |
|------------|-----------------|
| Student Admitted | `enrollment.student.admitted` |
| Teacher Joined | `workforce.teacher.joined` |
| Attendance Marked | `attendance.record.marked` |
| Assessment Created | `assessment.exam.created` |
| Exam Published | `assessment.exam.published` |
| Event Completed | `engagement.event.completed` |
| Report Generated | `document.report_card.generated` |
| Notification Sent | `notification.delivery.sent` |
| Academic Year Closed | `calendar.academic_year.closed` |

Full set: **67** named events across E01–E28 with producer, consumers, payload, trigger, sync/async.

### 20.3 Critical async chains

```text
payment.transaction.succeeded  →  fee.ledger.posted (E15)  →  document / notify
attendance.threshold.breached  →  fee fine command (E15) + communication
assessment.results.published   →  report_card.generated + parent notify
calendar.academic_year.closed  →  placements complete + lock assessments + close fee plans
```

### 20.4 Placement rule (events)

Every feature that affects another engine must list:

1. Events **emitted** (catalogue names)  
2. Events **consumed**  
3. Sync vs async justification  

---

## 21. Phase 0.5 — RBAC

**Status:** Matrix design `SHIPPED` (2026-08-06). **Runtime AuthZ platform `SHIPPED` (§56)** — `lib/authz`, `requirePermission`, custom roles, SQL `has_permission`. Parent/student portal UX still open.

**Canonical docs:** [`docs/architecture/rbac.md`](architecture/rbac.md) · [`authorization-platform.md`](architecture/authorization-platform.md)

### 21.1 Personas

| Current | Future |
|---------|--------|
| Super Admin, School Admin, Principal, Vice Principal, HOD, Teacher, Student, Parent | Accountant, class-teacher attribute, counsellor, librarian, receptionist, `custom:*` |

Capability class (`person_roles`) ≠ school persona (designation/grants). E03 evaluates; E01/E04/E05/E06 supply membership evidence.

### 21.2 Actions (every engine)

Read · Create · Edit · Delete · Approve · Lock · Publish · Archive — with scopes **●** school / **◐** attribute-scoped / **◇** platform / **—** deny.

### 21.3 RLS vs application

| RLS | Application (E03) |
|-----|-------------------|
| Tenant isolation, self `persons`, link-based visibility, coarse deny-by-default | Approve/lock/publish/archive, HOD/dept/section attributes, workflow state, multi-role session, AI accept-as-human |

Defense in depth: app asserts permission keys; RLS still filters rows.

### 21.4 Placement rule (AuthZ)

Every feature must list:

1. Permission keys required  
2. Personas allowed (or custom role bundles)  
3. Scope (● / ◐ / attributes)  
4. Whether new RLS is needed vs app-only check  

---

## 22. Phase 0.5 — Versioning & editing

**Status:** Design-only (2026-08-06). Mutation contract so config stays editable without corrupting historical ops. Partial append-only already exists (employments, placements); full config versioning **NOT BUILT**.

**Canonical doc:** [`docs/architecture/versioning.md`](architecture/versioning.md)

### 22.1 Principles

- **Configuration** (subjects, scales, periods, templates) → editable via rename / version / archive / effective-date  
- **Departments** (E05) → rename / archive; memberships dated; never version Person data under dept 
- **Operational facts** (results, attendance, ledger, payments, issued docs, audit) → append-only or compensating; no silent rewrite  
- Prefer **Archive** over hard delete; **pin version ids** or **snapshot** on issue  
- Academic year close → **Lock**; rollover creates new year-scoped rows, does not mutate closed years  

### 22.2 Strategy codes

| Code | Meaning |
|------|---------|
| M | Mutable in place (draft / cosmetic) |
| R | Soft rename (same id) |
| V | Versioned config (new immutable version) |
| E | Effective-dated |
| A | Append-only operational |
| C | Compensating correction |
| X | Immutable after publish/lock |
| K | Archive-only retirement |

### 22.3 Example guards

| Edit | Rule |
|------|------|
| Class / subject / department name | Rename (R) or archive (K); no semantic in-place morph |
| Grading system | New scale version (V); results pin old version |
| Teachers | End employment + new assignment; don’t rewrite past marks ownership |
| Report card template | New template version; issued docs pin version + PDF |
| Timetable periods | New grid version; published grid immutable |

### 22.4 Placement rule (versioning)

Every mutating feature must state strategy code, effect on **past** vs **future**, and which dangerous scenarios (D1–D15) it mitigates.

---

## 23. Phase 0.5 — Audit logging

**Status:** Design-only (2026-08-06). E28 Audit contract; **runtime `NOT BUILT`**.

**Canonical doc:** [`docs/architecture/audit-log.md`](architecture/audit-log.md)

### 23.1 What every audit row carries

| Dimension | Content |
|-----------|---------|
| **What** | Controlled `action` + outcome |
| **Who** | Actor type, auth_user, person, persona, impersonator, service name |
| **Old / new** | Redacted field diffs (ids/enums; no secrets/Aadhaar/PAN) |
| **When** | `occurred_at` (+ `recorded_at`) |
| **School** | `school_id` (null only for platform scope) |
| **Entity** | `entity_type` + `entity_id` (+ related entities) |
| **Severity** | `debug` → `critical` |
| **Retention** | Tiers T0–T4 (standard 24 mo; financial/security 7–10 yr; legal hold) |

### 23.2 Always audit

AuthN/AuthZ changes, tenancy lifecycle, identity/workforce/enrollment mutations, config publish/archive, assessment publish/corrections, fee/payment/ledger, document issue, break-glass, AI accept, ingestion commit/fail.

### 23.3 Events vs audit

Domain events fan out to engines; audit stores actor + diffs for compliance. Both may reference each other; audit is not OLTP truth.

### 23.4 Analytics (future)

Admin workload, security anomalies, correction rates, fee risk, config churn, AI adoption — via E22/SIEM on `audit.entry.recorded`, PII-minimized.

### 23.5 Placement rule (audit)

Every important write declares audit action, severity, retention tier, redacted diff fields, and sync vs async persistence.

---

## 24. Phase 0.5 — Notification Engine

**Status:** Design (2026-08-06) + E19 pipe `SHIPPED` (§49) + **ops chains `SHIPPED` (§58)** — domain outbox → orchestrator → workers. Provider adapters remain stub-safe until env keys. Content/consent remain **E18**.

**Canonical docs:** [`notification-engine.md`](architecture/notification-engine.md) · [`notification-operations.md`](architecture/notification-operations.md) · `lib/notifications/` · `lib/domain-events/` · `lib/notify-orchestration/`

### 24.1 Boundary

```text
Domain emit → domain_event_outbox → orchestrator → E19 enqueue → worker → ChannelAdapter
E18 human compose → fanOut → enqueueDelivery (unchanged)
```

Domain modules must **not** own WhatsApp/email/SMS/push SDKs.

### 24.2 Coverage

| Concern | Design / runtime |
|---------|------------------|
| **Types** | Controlled codes; `notification_types` seeded (§49) |
| **Channels** | `in_app` delivers immediately; email/whatsapp/sms/push queued (stub) |
| **Recipients** | Resolvers via E18 `resolveMessageAudience` |
| **Templates** | E18 versioned MessageTemplate; E19 maps provider template ids (future) |
| **Priorities** | critical / high / normal / low (+ quiet hours future) |
| **Scheduling** | `scheduled_for` on messages + delivery requests |
| **Retry** | Outbox + attempts tables; worker loop future |
| **Read receipts** | `read_at` / status `read` on delivery requests |
| **History** | `listNotificationHistoryAction` |

### 24.3 Placement rule (notify)

Features that alert users name: event, notification type, resolver, channels, template, transactional vs marketing, dedupe/schedule.

---

## 25. Phase 0.5 — AI architecture

**Status:** Design-only (2026-08-06). **E23** assistive layer; runtime `NOT BUILT`. **P8:** AI never becomes source of truth.

**Canonical doc:** [`docs/architecture/ai-architecture.md`](architecture/ai-architecture.md)

### 25.1 Core rule

```text
Read engines / E22 marts / ACL RAG → model → answer or AISuggestion
     → human accept → owning engine command → events + audit
```

No silent inserts/updates to admissions, marks, fees, attendance, etc.

### 25.2 Coverage

| Area | Design |
|------|--------|
| **Services** | Chat, drafts, insights, analytics narration, future agents |
| **Knowledge** | OLTP DTOs, E22 marts, ACL embeddings — no cross-tenant PII |
| **Context** | System + AuthZ + structured facts + RAG citations |
| **Retrieval** | School-partitioned hybrid RAG with ACL tags |
| **Memory** | Session / preference / school playbook — not OLTP |
| **Permissions** | User-scoped tools; accept re-checks target keys |
| **Tool calling** | Allowlisted read/draft/command; writes gated |
| **Personas** | Teacher, Student, Parent, Principal, Analytics AI scopes |
| **Lesson / reports** | Drafts only; E10 / E11 / E20 own persistence & PDFs |
| **Agents** | L0→L4 evolution; confirm writes; kill switches |

### 25.3 Placement rule (AI)

AI features declare service ID, personas, sources/tools, output kind (answer/draft/suggestion), accept engine, memory scope, redaction policy.

---

## 26. Phase 0.5 complete — Architecture review

**Status:** **COMPLETE** (2026-08-06). Chief Software Architect review of all Phase 0.5 architecture docs.

**Canonical doc:** [`docs/architecture/phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md)

### 26.1 Declaration

**Phase 0.5 — Architecture is complete.** Engines, domain model, events, RBAC, versioning, audit, notifications, and AI are accepted as **binding contracts**. No further Phase 0.5 design docs are required unless a P0 item needs a dedicated deep-dive (Fee, F11, rollover).

### 26.2 Verdict

Boundaries and ownership are strong. The main risk is **shipping Fee / portals / WhatsApp against today’s signup + admin-only RLS** before closing P0 seams.

### 26.3 Top weaknesses (summary)

| ID | Weakness |
|----|----------|
| W1 | Signup always creates school (F11) |
| W2 | RLS membership still `profiles`-only |
| W3–W4 | Column-owner drift; dual teaching maps |
| W5–W6 | No outbox; no command catalogue |
| W8 | Event naming drift engines §12 vs catalogue |

**Missing engines:** none required. Missing **depth:** Fee deep-dive, integration/webhook boundary naming.

### 26.4 P0 improvements (before Fee, portals, WhatsApp)

| # | Improvement |
|---|-------------|
| 1 | F11 signup-trigger split |
| 2 | Membership RLS (`profiles` ∪ employments ∪ admissions ∪ parent links) |
| 3 | Transactional outbox + event envelope |
| 4 | Fee Engine deep-dive (versions, ledger, payer) |
| 5 | Year-rollover playbook |

**P1:** RBAC-1 invite, permission keys, E05/E10 teaching resolution, versioning primitives, AuditEntry, in-app notify pipe, admin membership strategy.  
**P2:** Column façades, command catalogue, AI readiness gates.

### 26.5 Sequence into Phase 1

```text
F11 → membership RLS → outbox
  → Fee + versioning deep-dive → year rollover
  → invite / RBAC-1 → audit
  → in-app notifications
  → results / attendance / payments channels
  → AI last among these
```

### 26.6 Phase gate rule

Reject implementation PRs for invites, Fee, parent/student portals, or provider notifications until the relevant **P0** items are design-locked (and preferably stubbed). Architecture docs remain the source of truth for review.

---

## 27. User journeys

**Status:** Design (2026-08-06). Target journeys for all school personas. **Live today:** School Admin only.

**Canonical doc:** [`docs/architecture/user-journeys.md`](architecture/user-journeys.md)

### 27.1 Personas covered

| Persona | Focus |
|---------|--------|
| School Admin | Setup, people, fees, year close, invites |
| Principal | School-wide academics/ops approvals |
| HOD | Department-scoped teaching & assessment |
| Teacher | Attendance, marks, lesson plans, class comms |
| Parent | Linked children — fees, attendance, results |
| Student | Self — timetable, published results, docs |

### 27.2 Each journey defines

Daily tasks · engines · data created · data consumed · approvals · notifications · AI tools.

### 27.3 Cross-flows (examples)

Absence → parent alert · Results → report card · Fee due → pay · Teacher invite → join.

### 27.4 Placement rule (UX)

New screens must map to a persona section in `user-journeys.md` and stay within that persona’s RBAC scope.

---

## 28. Phase 1 — Configuration Engine

**Status:** Backend `SHIPPED` (2026-08-07). UI admin screens **not built**.  
**Canonical doc:** [`docs/architecture/configuration-engine.md`](architecture/configuration-engine.md)  
**Module:** `lib/config/**`  
**Migration:** `supabase/migrations/20260807120000_configuration_engine.sql` (applied to linked project)

### 28.1 Audit outcomes

| Finding | Action taken |
|---------|----------------|
| Subjects/houses/clubs wipe-rewrite | Replaced with upsert + **archive** |
| No archive columns | Added `archived_at` / `updated_at` |
| Subject CASCADE destroyed ops FKs | `ON DELETE RESTRICT` on employment/exam/class_subjects |
| Hard DELETE on catalogs | **Revoked** for `authenticated` |
| Missing grading scales | Added `grading_scales` + `grading_scale_versions` |
| Missing club memberships | Added `club_memberships` (dated `left_on`) |
| No `lib/config/` | Created engine module |
| Departments / fee heads / classes | **Not** moved into E07 (correct owners) |

### 28.2 Supported operations

Every catalog object: **create · edit · archive · restore**. No hard deletes.

| Object | Notes |
|--------|-------|
| Subjects | Stable `code`; archive missing on sync |
| Class–subjects | Replace-per-class (offer map only) |
| Houses / Clubs | Upsert + archive; house `code` |
| Grading scales | New immutable version on band publish |
| School branding | E07 columns only (`updateSchoolBrandingAction`) |
| Club memberships | Join / leave (`left_on`) |

### 28.3 Tests

`npx tsx scripts/smoke-config-validation.ts` — validation helpers.

### 28.4 Explicitly out of scope (this slice)

- Config admin UI  
- Event outbox (`config.catalog.updated`)  
- Splitting onboarding school-identity month write into E08-only action  
- HouseMembership first-class (still admission.house_id)

### 28.5 Placement rule

Config mutations go through `lib/config/*-actions.ts`. Onboarding calls these APIs; do not reintroduce delete-all catalog saves.

---

## 29. Phase 1 — Academic Calendar Engine

**Status:** Backend + minimal admin UI `SHIPPED` (2026-08-07).  
**Canonical doc:** [`docs/architecture/academic-calendar-engine.md`](architecture/academic-calendar-engine.md)  
**Module:** `lib/calendar/**`  
**UI:** `/dashboard/calendar`  
**Migration:** `supabase/migrations/20260807130000_academic_calendar_engine.sql`

### 29.1 Ownership

| Concern | Engine | Table |
|---------|--------|-------|
| Years / terms / working days / holidays | **E08** | `academic_years`, `terms`, `school_working_day_patterns`, `holidays` |
| Occasions (PTM, sports, trips, …) | **E17** | `calendar_events` |

Holiday ≠ CalendarEvent ≠ TimetableSlot.

### 29.2 Audit outcomes

| Finding | Action taken |
|---------|----------------|
| Years/terms only; no holidays/events | Added `holidays`, `calendar_events`, working-day patterns |
| No year lifecycle status | `status` draft/active/closed + `archived_at` |
| Hard DELETE on years | Revoked for `authenticated` |
| Holidays vs occasions mixed in product language | Separate tables; UI copy clarifies |
| Future recurrence/notify/attendance/AI | Nullable stub columns only |

### 29.3 Supported operations

| Object | Operations |
|--------|------------|
| Academic year | create, activate, close, archive |
| Term | create, edit, archive, restore |
| Working days | upsert (school default or per year) |
| Holiday | create, edit, archive, restore |
| Calendar event | create, edit, set approval, archive, restore |

Event fields: title, description, category, start/end, all-day, location, visibility, audience, academic year, term, created by, approval status.

### 29.4 Tests

`npx tsx scripts/smoke-calendar-validation.ts` — validation helpers.

### 29.5 Explicitly out of scope (this slice)

- Recurring event expansion / RRULE engine  
- Attachments UI · publish notifications · event attendance · AI summaries  
- Moving `schools.academic_year_start_month` writes fully off onboarding into E08-only action  
- Rewiring onboarding `saveTermsAction` off delete-all (still works; calendar API prefers archive)

### 29.6 Placement rule

Calendar mutations go through `lib/calendar/*-actions.ts`. Do not store holidays inside `calendar_events`.

---

## 30. Phase 1 — Department Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**.  
**Owner:** **E05 Workforce** (department org surface)  
**Canonical doc:** [`docs/architecture/department-engine.md`](architecture/department-engine.md)  
**Module:** `lib/departments/**`  
**Migration:** `supabase/migrations/20260807140000_department_engine.sql`

### 30.1 Hard rule

Departments **never own teachers**. Teachers belong to **Person** (E04). Departments own **relationships** to `teacher_employments`.

### 30.2 Supported objects

| Object | Operations |
|--------|------------|
| Department | create, edit, archive, restore + history |
| Membership | add/update roles (`head` / `coordinator` / `member`); end (dated) |
| Department subject | link / unlink (archive) E07 subjects |
| Teaching assignment | create / end employment↔subject relationship |
| Announcement | create, update, archive |
| Resource | create, update, archive |
| History | append-only read |

### 30.3 Ownership & tracking

- `created_by` / `updated_by` on departments, announcements, resources  
- `department_history` append-only trail for mutations  
- Membership / assignment dated history via `joined_on`/`left_on` and `started_on`/`ended_on`  
- Future stubs: `parent_department_id`, `cost_center_code`, `media_id`, `notify_on_publish`

### 30.4 Compatibility

Membership writes sync `teacher_employments.department_id` + `is_hod` so existing staff onboarding keeps working until rewired.

### 30.5 Tests

`npx tsx scripts/smoke-department-validation.ts`

### 30.6 Out of scope

- Admin UI  
- Nested department UX  
- E18/E19 fan-out on announce  
- Full onboarding rewire onto membership APIs  

### 30.7 Placement rule

Department mutations go through `lib/departments/*-actions.ts`. Do not insert Person/TeacherProfile under departments.

---

## 31. Phase 1 — House & Club Engine

**Status:** Backend + minimal admin UI `SHIPPED` (2026-08-07).  
**Owner:** **E07 Configuration** (house/club surface)  
**Canonical doc:** [`docs/architecture/house-club-engine.md`](architecture/house-club-engine.md)  
**Module:** `lib/houses-clubs/**`  
**UI:** `/dashboard/houses-clubs`  
**Migration:** `supabase/migrations/20260807150000_house_club_engine.sql`

### 31.1 Supported

| Object | Notes |
|--------|-------|
| Houses / Clubs | name, code, description, colour(s), logo_path, academic year, TIC employment, archive |
| Membership | dated house/club memberships |
| Captains | `captain` / `vice_captain` roles (one active each per house/club×year) |
| Teacher in charge | `teacher_in_charge_employment_id` → employment, not Person |

### 31.2 Future (schema stubs only)

`house` / `club` catalog + `house_memberships` / `club_memberships` / `club_event_links` (E17). Flags `points_tracking_enabled`, `events_enabled`. (House points ledger dropped until competitions ship.)

### 31.3 Compatibility

- Onboarding catalog sync still via `lib/config/houses-actions` / `clubs-actions`  
- Club memberships re-exported from engine  
- Active house membership syncs `student_admissions.house_id`

### 31.4 Tests

`npx tsx scripts/smoke-houses-clubs-validation.ts`

### 31.5 Placement rule

House/club relationship mutations go through `lib/houses-clubs/*`. Do not store student/teacher PII on house/club rows.

---

## 32. Phase 1 — Subject Configuration Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**.  
**Owner:** **E07 Configuration** (subject master surface)  
**Canonical doc:** [`docs/architecture/subject-configuration-engine.md`](architecture/subject-configuration-engine.md)  
**Module:** `lib/subjects/**`  
**Migration:** `supabase/migrations/20260807160000_subject_configuration_engine.sql`

### 32.1 Supported

| Concern | Implementation |
|---------|----------------|
| Subject master | Rich `subjects` row: description, category, group, language, elective, board mapping, credits, weekly periods, lab, assessment_rules JSON, display_order |
| Subject groups | `subject_groups` catalog |
| Languages | `category=language`, `is_language`, `language_code` |
| Electives | `category=elective`, `is_elective` (+ class_subjects.is_elective for offer map) |
| Board mapping | `board_code`, `board_subject_name` |
| Assessment rules | JSON: grading_type, max/pass marks, practical weightage, internal assessment |
| Dependencies | `subject_dependencies`: prerequisite / corequisite / recommended |
| Archive | `archived_at` on subjects/groups/deps; DELETE revoked on subjects; FK RESTRICT on operational refs |

### 32.2 Future (stubs)

`textbook_isbn`, `textbook_title`, `ai_lesson_plan_enabled`, `chapter_map` on subjects (multi-book catalog deferred; `subject_textbooks` stub removed).

### 32.3 Compatibility

Onboarding `syncSubjectsCatalogAction` still sets name/code/type only — enriched fields preserved on update.

### 32.4 Tests

`npx tsx scripts/smoke-subject-validation.ts`

### 32.5 Placement rule

Rich subject mutations go through `lib/subjects/*-actions.ts`. Onboarding bulk sync stays on `lib/config/subjects-actions.ts`.

---

## 33. Phase 1 — Timetable Configuration Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**.  
**Owner:** **E10 Timetable**  
**Canonical doc:** [`docs/architecture/timetable-configuration-engine.md`](architecture/timetable-configuration-engine.md)  
**Module:** `lib/timetable/**`  
**Migration:** `supabase/migrations/20260807170000_timetable_configuration_engine.sql`

### 33.1 Supported

| Concern | Implementation |
|---------|----------------|
| Periods | Upsert, archive, educational vs break, custom name, **lock/unlock**; `period_number >= 0` |
| Weekly schedule | `timetable_slots` with day_of_week + period |
| Cycle days | `timetable_cycle_days` per grid |
| Alternate timetables | `timetable_grids` types: primary / alternate / exam / special |
| Teacher allocation | Slot `teacher_id` → employment; conflict-checked |
| Section allocation | Slot `section_id`; unique per grid×day×period |
| Availability | `teacher_availability`, `section_availability` |
| Conflict detection | Pure `detectSlotConflicts` + enforced on upsert |
| Period / slot locking | Blocks mutations until unlocked |

### 33.2 Future (stubs)

`rooms`, `timetable_slots.room_id` (substitutions / redundant `teacher_subject_assignments` stubs removed — slots + `employment_subjects` are SoT).

### 33.3 Conflict kinds blocked on save

`teacher_double_booked` · `section_double_booked` · `room_double_booked` · `teacher_unavailable` · `section_unavailable` · `period_locked` · `slot_locked` · `break_period` · `period_overlap`

### 33.4 Compatibility

Onboarding `saveTimetableAction` wipe-rewrite still works. Engine APIs prefer upsert/archive/lock. Existing slots backfilled onto primary weekly grids.

### 33.5 Tests

`npx tsx scripts/smoke-timetable-validation.ts`

### 33.6 Placement rule

Timetable mutations go through `lib/timetable/*-actions.ts`. Eligibility remains E05; schedule ownership is E10.

---

## 34. Phase 1 — Assessment Configuration Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**. Marks entry **not built**.  
**Owner:** **E11 Assessment** (config surface only)  
**Canonical doc:** [`docs/architecture/assessment-configuration-engine.md`](architecture/assessment-configuration-engine.md)  
**Module:** `lib/assessment/**`  
**Migration:** `supabase/migrations/20260807180000_assessment_configuration_engine.sql`

### 34.1 Supported

| Concern | Implementation |
|---------|----------------|
| Exam types | `assessment_exam_types` catalog + defaults |
| Assessment categories | theory / internal / practical / project / oral / optional |
| Weightages / passing marks | On types, definitions, components, schedules |
| Grading rules | `grading_type` + pin `grading_scale_version_id` (E07) |
| Internal / practical / projects | `assessment_components` + category kinds |
| Optional subjects | Schedule `is_optional_subject`; definition `includes_optional_subjects` |
| Subject groups | Optional FK to E07 `subject_groups` |
| Publishing rules | JSON on policy + definition; publish / schedule / retract |
| Lock rules | JSON + lock/unlock; edit/archive gated when locked |
| Future moderation / AI | Boolean flags only (`moderation_enabled`, `ai_evaluation_enabled`) |

### 34.2 Explicit non-goals

No `exam_results`, marks entry UI, moderation workflow, or AI evaluation behavior.

### 34.3 Compatibility

Onboarding `saveExamsAction` soft-archives then inserts per-class definitions (`class_id` required in the wizard; DELETE revoked). Prefer `lib/assessment/*-actions.ts` for ongoing admin config. `class_id` null remains school-wide.

### 34.4 Tests

`npx tsx scripts/smoke-assessment-validation.ts`

### 34.5 Placement rule

Assessment **configuration** mutations go through `lib/assessment/*-actions.ts`. Grading scales / subject groups stay E07. Results: Assessment Operations Engine (§45).

---

## 35. Phase 1 — Report Card Template Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**. PDF issue **not built**.  
**Owner:** **E20 Document** (template surface)  
**Canonical doc:** [`docs/architecture/report-card-template-engine.md`](architecture/report-card-template-engine.md)  
**Module:** `lib/report-cards/**`  
**Migration:** `supabase/migrations/20260807190000_report_card_template_engine.sql`

### 35.1 Supported

| Concern | Implementation |
|---------|----------------|
| Boards | `report_card_boards` catalog |
| Classes / sections | `report_card_template_scopes` |
| Dynamic sections | `report_card_template_blocks` (+ reorder) |
| Grades | Grades block + assessment bindings (`show_grades`) |
| Remarks | Remarks block + include flag |
| Attendance | Attendance block (binds E12 `attendance_records`; no facts owned) |
| Co-curricular | Co-curricular block |
| Teacher / principal comments | Dedicated blocks + include flags |
| Signatures | `report_card_template_signatures` (wet_ink / placeholder / digital_stub) |
| Custom layouts | `layout_config` JSON + `custom` block type |
| Assessment refs | `report_card_template_assessments.exam_definition_id` (E11) |
| Versioning | Publish → immutable `report_card_template_versions` snapshot |
| Future PDF | `pdf_generation_enabled` + `report_card_render_jobs` stub |
| Future digital signatures | `digital_signature_enabled` + `requires_digital` flags |

### 35.2 Explicit non-goals (template surface)

No DigiLocker. Marks/attendance facts stay in E11/E12. Issue/generation lives in §46.

### 35.3 Hard rule

Templates reference assessments; they do **not** store marks. Issued cards (§46) pin a template **version** and record `source_refs` to E11 results (presentation snapshot for reprint only).

### 35.4 Tests

`npx tsx scripts/smoke-report-card-validation.ts`

### 35.5 Placement rule

Template mutations go through `lib/report-cards/*-actions.ts`. Marks remain E11 (§45). Issue/generation: §46.

---

## 36. Phase 1 — School Policy Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**.  
**Owner:** **E07 Configuration** (policy definitions)  
**Canonical doc:** [`docs/architecture/school-policy-engine.md`](architecture/school-policy-engine.md)  
**Module:** `lib/policies/**`  
**Migration:** `supabase/migrations/20260807200000_school_policy_engine.sql`

### 36.1 Supported policy kinds

| Kind | Notes |
|------|-------|
| `attendance_rules` | Min % / absence thresholds |
| `promotion_rules` | Pass %, compartment, failed-subject caps |
| `working_hours` | Staff + instructional HH:MM |
| `school_timings` | Per-weekday open/close |
| `leave_types` | Catalog of leave codes |
| `late_arrival` | Grace minutes / late-after |
| `half_day` | Morning/afternoon cutoffs |
| `exam_eligibility` | Attendance gate (+ fee flag stub) |
| `grace_marks` | Caps / borderline-only |
| `behaviour_rules` | Warn/suspend thresholds |
| `fee_rules` | FUTURE stub |
| `transport_rules` | FUTURE stub |

### 36.2 Versioning

Every policy has `school_policy_versions`. Draft edit → publish (immutable + `is_current`). Further edits open version N+1. Year-scoped published policies override school-wide defaults of the same kind.

### 36.3 Explicit non-goals

No attendance marking, promotion execution, fee calculation, or transport routing. Policies are configuration only.

### 36.4 Tests

`npx tsx scripts/smoke-policy-validation.ts`

### 36.5 Placement rule

Policy mutations go through `lib/policies/*-actions.ts`. Instructional weekdays stay E08; hours/timings/thresholds are E07 policies. Consumers pin or read `is_current` versions.

---

## 37. Phase 1 — Communication Configuration Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI **not built**. Sending **not built**.  
**Owner:** **E18 Communication** (config surface)  
**Canonical doc:** [`docs/architecture/communication-configuration-engine.md`](architecture/communication-configuration-engine.md)  
**Module:** `lib/communications/**`  
**Migration:** `supabase/migrations/20260807210000_communication_configuration_engine.sql`

### 37.1 Supported

| Concern | Implementation |
|---------|----------------|
| Announcement categories | `comm_announcement_categories` |
| Priority levels | `comm_priority_levels` (critical/high/normal/low seeded) |
| Audience groups | `comm_audience_groups` + filter JSON |
| Notification / email / WhatsApp / SMS templates | `comm_message_templates.channel` |
| Template versioning | `comm_message_template_versions` (publish → immutable) |
| Delivery rules | `comm_delivery_rules` (event → channels/audience/template) |
| Approval rules | `comm_approval_rules` |
| Future automation | `comm_automations` shell (`is_enabled` forced false on write) |
| Future campaigns | `comm_campaigns` shell (draft only) |

### 37.2 Explicit non-goals

No queues, provider calls, delivery attempts, audience resolution at send-time, or live campaign execution (E19 / future).

### 37.3 Hard rule

**E18 = content + config; E19 = delivery.** This engine never sends.

### 37.4 Tests

`npx tsx scripts/smoke-communication-validation.ts`

### 37.5 Placement rule

Communication config mutations go through `lib/communications/*-actions.ts`. Department announcements (E05) remain dept-scoped; school-wide templates/rules are E18.

---

## 38. Phase 1 — Configuration Editing Framework

**Status:** Backend `SHIPPED` (2026-08-07). Full adoption across every config action is **in progress** (subjects + grading scales wired as reference).  
**Owner:** Cross-cutting · persists via **E28** `audit_entries`  
**Canonical doc:** [`docs/architecture/configuration-editing-framework.md`](architecture/configuration-editing-framework.md)  
**Module:** `lib/editing/**`  
**Migration:** `supabase/migrations/20260807220000_configuration_editing_framework.sql`

### 38.1 Audit of configuration modules (pre-framework)

| Module | Edit | Archive | Restore | Duplicate | History | Audit | Version | Deps |
|--------|------|---------|---------|-----------|---------|-------|---------|------|
| `lib/config` subjects/houses/clubs | partial | yes | yes | **added** (subjects) | via framework | via framework | scales **V** | framework |
| `lib/subjects` | yes | yes | partial | no | adopt | adopt | — | registry |
| `lib/calendar` | yes | yes | partial | no | adopt | adopt | year lock | registry |
| `lib/departments` | yes | yes | partial | no | adopt | adopt | — | registry |
| `lib/houses-clubs` | yes | yes | yes | no | adopt | adopt | — | registry |
| `lib/timetable` | yes | yes | locks | no | adopt | adopt | grids | conflict engine |
| `lib/assessment` | yes | yes | locks | no | adopt | adopt | publish/lock | registry |
| `lib/report-cards` | draft-only | yes | clone | clone | versions | adopt | **V** | registry |
| `lib/policies` | draft/version | yes | — | no | versions | adopt | **V** | — |
| `lib/communications` | draft/version | yes | — | no | versions | adopt | **V** | — |

### 38.2 Supported operations

Edit · Archive · Restore · Duplicate · History · Audit log · Version tracking · Validation · Dependency checks · Soft-migration recommendations.

### 38.3 Soft migration (instead of destructive updates)

When an edit would invalidate operational records, the framework **denies** the mutation and returns one or more of:

- **Rename only** (identity-preserving)  
- **Archive and create** replacement  
- **Clone / publish new version**  
- **Year-scoped clone**  
- **Blocked — use correction workflow**  

### 38.4 Tests

`npx tsx scripts/smoke-editing-validation.ts`

### 38.5 Placement rule

Config mutations should call `evaluateConfigEdit` before dangerous writes and `recordConfigMutation` after success. Hard delete of configuration remains denied.

---

## 39. Phase 1 — Configuration Dashboard

**Status:** Backend + UI `SHIPPED` (2026-08-07). **Wave 3 config hub** `SHIPPED` (2026-08-12).  
**Owner:** Cross-cutting (aggregator + thin edit panels; write paths stay in owning engines)  
**Canonical doc:** [`docs/architecture/configuration-dashboard.md`](architecture/configuration-dashboard.md)  
**Module:** `lib/config-dashboard/**`  
**UI:** `/dashboard/configuration` (`?tab=` hub)  
**Migration:** `schools.code` (`20260807520000_schools_code.sql`)

### 39.1 What it shows

| Signal | Source |
|--------|--------|
| Completion status | Per-module heuristics over active row counts + school flags |
| Warnings | Soft gaps (empty holidays, unpublished policies/templates, …) |
| Missing configuration | Hard gaps (no year/terms/classes/subjects when required) |
| Dependency errors | Cross-module breakage (e.g. slots → archived subjects; published RC templates without assessment bindings) |
| Health checks | Informational readiness notes (`backend_only` modules, feature flags) |
| Links | Hub tabs + admin pages (subjects, houses, principal teachers/students, …) — **not** `/onboarding/*` after go-live |

### 39.2 Catalog modules

School branding · Academic calendar · Classes & sections · Subjects · Grading scales · Houses & clubs · Departments · Timetable · Assessment · Report cards · Policies · Communications · Editing framework.

### 39.3 Config hub (Wave 3)

Onboarding steps as tabs: Health · School identity (incl. school code) · Terms (date edit; count lock) · Structure checklist · outbound links for subjects / houses / staff / students / timetable / exams / grading / departments. Term guards in `lib/calendar/term-edit-guards.ts`.

### 39.4 Tests

`npx tsx scripts/smoke-config-dashboard-validation.ts`

### 39.5 Placement rule

Write paths stay in owning engines (`lib/calendar`, `lib/subjects`, `lib/config/school-branding*`, …). The hub aggregates, links, and hosts thin panels that call those actions.

---

## 40. Phase 1 — Implementation audit

**Status:** Audit `SHIPPED` (2026-08-07). Phase 1 engines **SHIPPED**. Production gate **NOT PASSED**. Phase 1 **not marked COMPLETE**.  
**Canonical doc:** [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md)

### 40.1 Verdict

| Gate | Result |
|------|--------|
| Engines O–Z (§28–§39) implemented | PASS |
| Validation smokes | PASS |
| Production-ready (multi-tenant integrity, AuthZ, archive purity, editing adoption) | **FAIL** |
| Mark Phase 1 COMPLETE | **No** |

Safe for continued **school_admin-only** development. Block multi-persona production, Fee/send/portals, and production year rollover until P0 closed.

### 40.2 Critical / high themes

- Cross-school FK integrity gaps at DB (C2)
- Profile-only AuthZ (C1) — known §26 P0
- Hard deletes + exam mass-archive in onboarding/class-subjects (C3–C4)
- Incomplete DELETE revocation; dual year lifecycle; CASCADE asymmetry (H1–H3)
- Mutable “immutable” versions; migration-only seeds; audit CASCADE wipe (H4–H6)
- Dual SoTs (H7); editing framework barely adopted (H8)
- Uneven UI (calendar / houses-clubs / configuration only)

### 40.3 P0 hardening (before production-ready / COMPLETE)

1. Same-school / same-year FK guards  
2. Revoke DELETE on remaining archive-era tables  
3. Single academic-year lifecycle + audited activate/close  
4. Align year child ON DELETE with rollover playbook  
5. Immutable version enforcement at DB  
6. Seed-on-school-create  
7. Audit retention (no CASCADE wipe)  
8. Harden onboarding hard-delete / exam mass-archive  
9. Adopt editing framework on lifecycle mutations  
10. Membership RLS + app RBAC (F11 / §26)

### 40.4 Placement rule

Do not claim Phase 1 COMPLETE in plans or releases until §40.3 P0 is closed (or explicitly waived with written risk acceptance). Update this section when a re-audit passes the production gate.

---

## 41. Phase 2 — Daily operational workflows

**Status:** Design catalogue `SHIPPED` (2026-08-07). **No Phase 2 application code yet.**  
**Canonical doc:** [`docs/operations/daily-workflows.md`](operations/daily-workflows.md)

### 41.1 Why

Phase 1 configured the school. Phase 2 is **operations** — attendance, marks, fees, messaging, portals — which must be planned as named workflows per persona before coding.

### 41.2 What was audited

Business engines, domain model, system events, RBAC personas, notifications, AI services, versioning, user journeys, and Phase 1 engine handoffs (config vs facts).

### 41.3 Catalogue contents

| Section | Coverage |
|---------|----------|
| Personas | School Admin, Principal, Vice Principal, HOD, Teacher, Student, Parent, Support Staff (Accountant / Receptionist / Counsellor / Librarian) |
| Per workflow | Trigger · Owner · Data Created · Data Updated · Dependencies · Notifications · Future AI |
| Cross-chains | Absence→alert · Results→report card · Fee→pay · Teacher invite |
| Periodic / system | Exam cycles, PTM, fee billing, year rollover, cron jobs |
| Sequencing | Suggested implement order; P0 gates unchanged |

### 41.4 Gate

| Gate | Result |
|------|--------|
| Workflows documented | PASS |
| Implementation may begin | **Only after catalogue acceptance** |
| Phase 1 production gate (§40) | Still open (independent) |

### 41.5 Placement rule

Phase 2+ feature PRs must cite **workflow ID(s)** from `docs/operations/daily-workflows.md` in addition to engine / AuthZ / events / notify / AI.

---

## 42. Phase 2 — Student Profile Engine

**Status:** Backend aggregator `SHIPPED` (2026-08-07). Student Portal UI `SHIPPED` (§60).  
**Canonical doc:** [`docs/architecture/student-profile-engine.md`](architecture/student-profile-engine.md)  
**Module:** `lib/student-profile/**`  
**Migration:** `supabase/migrations/20260807230000_student_profile_engine.sql`  
**UI:** `/dashboard/student/**` (§60)  
**Workflows:** WF-ADM-01+, WF-TCH-*, WF-PAR-*, WF-STU-* (consume aggregate)

### 42.1 Purpose

Product **single source of truth surface** for a student. Aggregates every related module. **Never duplicates** operational rows into a profile blob.

### 42.2 Modules (17)

Personal · Admission · Academic history · Attendance · Assessments · Report cards · Events · Competitions · Achievements · Behaviour · Medical · Documents · Parents · Transport · House · Club membership · Future AI summary

### 42.3 Live vs schema-ready

| Live (read existing) | SCHEMA-READY stubs |
|----------------------|--------------------|
| persons, student_profiles, admissions, academic years, parents, houses/clubs memberships, exam schedules, calendar events, report templates, **`attendance_records` (E12)**, **`exam_results` (E11 ops)**, **`report_card_issues` / issued docs (E20)**, **`event_participants` / competition links (E17)**, **`conduct_incidents` (E13)** | `medical_incidents`, `student_achievements`, `student_transport_assignments` |

### 42.4 API

- `listStudentProfileDirectoryAction`  
- `getStudentProfileAction` / `getStudentProfileModuleAction`  
- `updateStudentPersonalInformationAction` → writes **E04/E14** tables only  

### 42.5 Tests

`npx tsx scripts/smoke-student-profile-validation.ts`

### 42.6 Placement rule

New student facts land in the **owning engine** table first; the profile module picks them up by reference. No `student_profiles.*_json` dumps.

---

## 43. Phase 2 — Teacher Workspace

**Status:** Homepage aggregator `SHIPPED` (2026-08-07). Feature routes via Teacher Portal §59.  
**Canonical doc:** [`docs/architecture/teacher-workspace.md`](architecture/teacher-workspace.md)  
**Module:** `lib/teacher-workspace/**`  
**UI:** `/dashboard/teacher` (homepage) · feature UIs under `/dashboard/teacher/*` (§59)  
**Migration:** `supabase/migrations/20260807240000_teacher_workspace.sql`  
**Workflows:** WF-TCH-01…11

### 43.1 Panels (all from operational data)

| Panel | Sources |
|-------|---------|
| Today's timetable | `timetable_slots` + periods/sections/subjects |
| Pending attendance | Today's taught sections missing `attendance_records` → links `/attendance` |
| Pending assessments | Published exam schedules without `exam_results` → links `/marks` |
| Homework | `homework_assignments` (**SHIPPED** §50; Teacher Workspace reads live) → `/homework` |
| Announcements | Published dept announcements (`staff`/`school`) → `/announcements` |
| Upcoming events | Approved/published `calendar_events` → `/events` |
| Class reminders | Remaining periods today + near-term events |
| Department notices | Published `visibility=department` for memberships |
| AI shortcuts | E23 service id placeholders only |

### 43.2 API

`buildTeacherWorkspace` · `listActiveEmployments` · `resolveEmploymentForAuthUser` (pages call helpers directly)

### 43.3 Tests

`npx tsx scripts/smoke-teacher-workspace-validation.ts`

### 43.4 Placement rule

No hardcoded timetable/homework/announcement demo content. Empty panels when tables have no rows. After AuthN binds `auth_user_id`, teacher post-login home → `/dashboard/teacher`. Feature writes live in §59 over engine actions only.

---

## 44. Phase 2 — Attendance Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher Portal mark UI `SHIPPED` (§59). Period attendance API stubbed (`FUTURE`).  
**Canonical doc:** [`docs/architecture/attendance-engine.md`](architecture/attendance-engine.md)  
**Module:** `lib/attendance/**`  
**Migration:** `supabase/migrations/20260807250000_attendance_engine.sql` (pushed)  
**Workflows:** WF-TCH-01 (mark); WF-PAR-01 / WF-STU-03 (consume visible facts)

### 44.1 Capabilities

| Capability | Status |
|------------|--------|
| Daily attendance | `SHIPPED` |
| Bulk attendance | `SHIPPED` |
| Late / half day / leave / excused | `SHIPPED` (mark statuses + leave requests) |
| Period attendance | Schema + stub API (`enablePeriodAttendance` gate) |
| Session submit / approve / lock / unlock | `SHIPPED` |
| Corrections (supersede + compensating row) | `SHIPPED` |
| Engine audit log | `SHIPPED` |
| Analytics (derived counts/rates) | `SHIPPED` |
| Teacher edit until approved/locked | Enforced in actions |
| Auto-visible to parents/students after approve/lock | `visible_to_guardians` / `visible_to_students` |

### 44.2 Tables

`attendance_sessions` · enriched `attendance_records` · `attendance_leave_requests` · `attendance_audit_log`

### 44.3 API

`upsertDailyAttendanceAction` · `bulkMarkDailyAttendanceAction` · `markPeriodAttendanceAction` (stub) · `submitAttendanceSessionAction` · `approveAttendanceSessionAction` · `lockAttendanceSessionAction` · `unlockAttendanceSessionAction` · `correctAttendanceAction` · leave create/decide/list · `listSectionAttendanceAction` · `listStudentAttendanceAction` · `getAttendanceAnalyticsAction` · `listAttendanceAuditAction`

### 44.4 Tests

`npx tsx scripts/smoke-attendance-validation.ts`

### 44.5 Placement rule

No student names/phones on attendance rows. After approve/lock, Student Profile and future portals read the same facts (no duplicate store). Fee fines stay E15. Marks entry is E11 ops (§45 / WF-TCH-05).

---

## 45. Phase 2 — Assessment Operations Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher Portal marks UI `SHIPPED` (§59).  
**Canonical doc:** [`docs/architecture/assessment-operations-engine.md`](architecture/assessment-operations-engine.md)  
**Module:** `lib/assessment/**` (ops alongside config)  
**Migration:** `supabase/migrations/20260807260000_assessment_operations_engine.sql` (pushed)  
**Workflows:** WF-TCH-05 (enter marks); WF-HOD-03 / WF-PRI-08 (publish/lock); WF-PAR-05 / WF-STU-04 (consume)

### 45.1 Capabilities

| Capability | Status |
|------------|--------|
| Scheduled assessments (admin defs + schedules) | `SHIPPED` (list + marks against them) |
| Teacher-created assessments | `SHIPPED` |
| Class tests / projects / practicals / assignments / oral | `SHIPPED` (`operational_kind`) |
| Marks entry (single) | `SHIPPED` |
| Bulk marks entry | `SHIPPED` |
| Teacher remarks | `SHIPPED` |
| Draft / published / locked modes | `SHIPPED` |
| Teacher edit until Admin/HOD lock | Enforced in actions |
| Corrections (supersede + compensating row) | `SHIPPED` |
| Results audit log | `SHIPPED` |
| Marks analytics (derived) | `SHIPPED` |
| Auto-visible to parents/students after publish/lock | `visible_to_*` flags |

### 45.2 Tables

`assessment_mark_sessions` · enriched `exam_results` · `assessment_results_audit_log` · `exam_definitions.origin` / `operational_kind` · `exam_subject_schedules.section_id`

### 45.3 API

`createTeacherAssessmentAction` · `listTeacherAssessmentsAction` · `listScheduledAssessmentsAction` · `archiveTeacherAssessmentAction` · `upsertMarkAction` · `bulkUpsertMarksAction` · `correctMarkAction` · `publishMarkSessionAction` · `lockMarkSessionAction` · `unlockMarkSessionAction` · `listSessionMarksAction` · `listStudentMarksAction` · `getMarksAnalyticsAction` · `listAssessmentResultsAuditAction`

### 45.4 Tests

`npx tsx scripts/smoke-assessment-ops-validation.ts`

### 45.5 Placement rule

No silent overwrite of historical marks — corrections supersede. Config stays §34; results never duplicated into report-card templates or student blobs.

---

## 46. Phase 2 — Report Card Engine

**Status:** Backend `SHIPPED` (2026-08-07). **Extended by Phase 3 §65.** UI `NOT BUILT`. PDF media `NOT BUILT`.  
**Canonical doc:** [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md)  
**Module:** `lib/report-cards/**` (issue alongside templates)  
**Migration:** `supabase/migrations/20260807270000_report_card_engine.sql` (pushed) · Phase 3 `20260807480000`  
**Workflows:** WF-PER-02 (issue); WF-PRI-09 (readiness); WF-TCH-08 (remarks); WF-PAR-06 / WF-STU-06 (consume)

### 46.1 Capabilities

| Capability | Status |
|------------|--------|
| Generate from assessment data | `SHIPPED` → prefer E33 (§65); E11 fallback |
| Attendance summary (E12) | `SHIPPED` |
| Teacher remarks (per-subject + card-level) | `SHIPPED` (+ field assignments §65) |
| Co-curricular (house/club) | `SHIPPED` |
| Behaviour (conduct incidents) | `SHIPPED` (E13 §48) |
| Promotion status | `SHIPPED` |
| Principal remarks | `SHIPPED` |
| No duplicated assessment OLTP | Enforced (`source_refs` + presentation snapshot only) |
| Version history | `SHIPPED` (`report_card_issue_versions`) |
| Issue / reissue / revoke | `SHIPPED` (publish/lock in §65) |
| PDF bytes / DigiLocker | `NOT BUILT` |

### 46.2 Tables

`report_card_issues` · `report_card_issue_versions` · `report_card_audit_log` · enriched `student_issued_documents` · `report_card_render_jobs.report_card_issue_version_id`

### 46.3 API

See §65 for Phase 3 API (fill / lock / field assignments). Legacy issue actions remain.

### 46.4 Tests

`npx tsx scripts/smoke-report-card-ops-validation.ts` · `scripts/smoke-report-card-phase3-validation.ts`

### 46.5 Placement rule

Assemble from owning engines; never insert parallel `exam_results`. Published/locked versions are immutable; reissue opens a new version. Templates stay §35. **Phase 3 details: §65.**

---

## 47. Phase 2 — Event & Activity Engine

**Status:** Backend `SHIPPED` (2026-08-07). UI `NOT BUILT`. Media bytes `NOT BUILT` (uuid[] refs).  
**Canonical doc:** [`docs/architecture/event-activity-engine.md`](architecture/event-activity-engine.md)  
**Module:** `lib/events/**`  
**Origin:** Always `calendar_events` (Academic Calendar / E17). Holidays remain E08.  
**Migration:** `supabase/migrations/20260807280000_event_activity_engine.sql` (pushed)  
**Workflows:** WF-ADM-07 · WF-PER-10/11 · WF-PAR-07 · WF-STU-09

### 47.1 Activity types

Sports · Competitions · Assemblies · Trips · Workshops · Club activities · House activities · Cultural programs (+ PTM / annual day / custom)

### 47.2 Per-event capabilities

| Capability | Status |
|------------|--------|
| Participants | `SHIPPED` |
| Teachers in charge | `SHIPPED` (`event_staff_assignments`) |
| Attendance | `SHIPPED` (`attendance_status`) |
| Awards / positions | `SHIPPED` |
| Certificates | `SHIPPED` (E20 issued doc link) |
| Remarks | `SHIPPED` |
| Attachments / photos | Schema refs `SHIPPED`; Media engine later |
| Profile auto-surface | `SHIPPED` (read by FK — no event dump) |

### 47.3 Tables

Enriched `calendar_events` · `event_staff_assignments` · enriched `event_participants` · competition projection · `event_activity_audit_log`

### 47.4 API

`createActivityEventAction` · `updateActivityEventMetaAction` · `upsertEventStaffAssignmentAction` · `archiveEventStaffAssignmentAction` · `upsertEventParticipantAction` · `bulkUpsertEventParticipantsAction` · `archiveEventParticipantAction` · `issueEventCertificateAction` · `listActivityEventsAction` · `getActivityEventDetailAction` · `listStudentEventParticipationsAction` · `listEventActivityAuditAction`

### 47.5 Tests

`npx tsx scripts/smoke-event-activity-validation.ts`

### 47.6 Placement rule

Do not duplicate event information inside students. Participation rows hold FKs + outcomes; titles/dates/locations stay on `calendar_events`.

---

## 48. Phase 2 — Behaviour Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher Portal remarks UI `SHIPPED` (§59).  
**Canonical doc:** [`docs/architecture/behaviour-engine.md`](architecture/behaviour-engine.md)  
**Module:** `lib/behaviour/**`  
**Migration:** `supabase/migrations/20260807290000_behaviour_engine.sql` (pushed)  
**Workflows:** WF-TCH-03 · WF-HOD-06 · WF-PRI-02 · WF-VP-02 · WF-ADM-12 · WF-SUP-COU-01 · WF-PAR-09

### 48.1 Capabilities

| Capability | Status |
|------------|--------|
| Positive remarks | `SHIPPED` (`remark_kind=positive`) |
| Disciplinary remarks | `SHIPPED` |
| Warnings | `SHIPPED` |
| Commendations | `SHIPPED` |
| Teacher notes | `SHIPPED` |
| Private notes | `SHIPPED` (`visibility=private`) |
| Parent visible notes | `SHIPPED` (`parent_visible` / `school`) |
| Follow-up actions | `SHIPPED` (`behaviour_follow_ups`) |
| Timestamped (`recorded_at`) | `SHIPPED` |
| Filter by academic year | `SHIPPED` |
| Future analytics (derived) | `SHIPPED` (`getBehaviourAnalyticsAction`) |

### 48.2 Tables

Enriched `conduct_incidents` · `behaviour_follow_ups` · `behaviour_audit_log`

### 48.3 API

`createBehaviourRemarkAction` · `updateBehaviourRemarkAction` · `setRemarkVisibilityAction` · `archiveBehaviourRemarkAction` · `createBehaviourFollowUpAction` · `updateBehaviourFollowUpAction` · `archiveBehaviourFollowUpAction` · `listBehaviourRemarksAction` · `getBehaviourRemarkAction` · `listBehaviourFollowUpsAction` · `getBehaviourAnalyticsAction` · `listBehaviourAuditAction`

### 48.4 Tests

`npx tsx scripts/smoke-behaviour-validation.ts`

### 48.5 Placement rule

Assessment/report remarks stay E11/E20. Behaviour facts live in E13; Student Profile and Report Cards read by reference.

---

## 49. Phase 2 — Communication Operations Engine

**Status:** Backend `SHIPPED` (2026-08-07). UI `NOT BUILT`. External providers stubbed (`in_app` live).  
**Canonical doc:** [`docs/architecture/communication-operations-engine.md`](architecture/communication-operations-engine.md)  
**Modules:** `lib/communications/**` (ops) · `lib/notifications/**` (E19)  
**Config:** §37 Communication Configuration remains the catalog/rules surface  
**Migration:** `supabase/migrations/20260807300000_communication_operations_engine.sql` (pushed)  
**Workflows:** WF-ADM-06 · WF-PRI-04 · WF-HOD-05 · WF-TCH-04 · WF-SYS-04

### 49.1 Capabilities

| Capability | Status |
|------------|--------|
| Announcements | `SHIPPED` (`message_kind=announcement`) |
| Circulars | `SHIPPED` |
| Department messages | `SHIPPED` |
| Teacher messages | `SHIPPED` |
| Class messages | `SHIPPED` |
| Parent notifications | `SHIPPED` (`parent_notice`) |
| Student notifications | `SHIPPED` (`student_notice`) |
| Audience targeting | `SHIPPED` (`resolveMessageAudience`) |
| Scheduling | `SHIPPED` (`scheduled` + `scheduled_for`) |
| Attachments | `SHIPPED` (`attachment_media_ids` uuid refs) |
| Read receipts | `SHIPPED` (`read_at` / `markNotificationReadAction`) |
| Notification history | `SHIPPED` (`listNotificationHistoryAction`) |
| Uses Notification Engine (E19) | `SHIPPED` (`enqueueDelivery` + outbox) |
| Email / WhatsApp / SMS / push providers | Stub / queued only |

### 49.2 Tables

`comm_messages` · `comm_message_audit_log` · `notification_types` · `notification_delivery_requests` · `notification_delivery_attempts` · `notification_outbox`

### 49.3 API

**E18:** `createCommMessageAction` · `updateCommMessageAction` · `publishCommMessageAction` · `cancelCommMessageAction` · `archiveCommMessageAction` · `listCommMessagesAction` · `getCommMessageAction` · `listMessageReadReceiptsAction` · `listCommMessageAuditAction`

**E19:** `enqueueDelivery` · `listNotificationHistoryAction` · `markNotificationReadAction` · `listNotificationAttemptsAction` · `listNotificationTypesAction`

### 49.4 Tests

`npx tsx scripts/smoke-communication-ops-validation.ts`

### 49.5 Placement rule

E18 owns content and audience intent; E19 owns delivery attempts and receipts. Domain engines emit events / call compose — they never embed provider SDKs. Config catalogs stay §37.

---

## 50. Phase 2 — Homework & Assignment Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher Portal UI `SHIPPED` (§59). Student self-submit `FUTURE`. AI evaluation schema-only.  
**Canonical doc:** [`docs/architecture/homework-assignment-engine.md`](architecture/homework-assignment-engine.md)  
**Module:** `lib/homework/**`  
**Migration:** `supabase/migrations/20260807310000_homework_assignment_engine.sql` (pushed)  
**Base stub:** enriched `homework_assignments` from §43 Teacher Workspace  
**Workflows:** WF-STU-04 · WF-PAR-05 · WF-TCH-07 (adjacent lesson planning)

### 50.1 Capabilities

| Capability | Status |
|------------|--------|
| Homework | `SHIPPED` (`assignment_kind=homework`) |
| Assignments | `SHIPPED` |
| Projects | `SHIPPED` |
| Attachments | `SHIPPED` (`attachment_media_ids` uuid refs) |
| Submission dates | `SHIPPED` (`due_on` / `due_at` / `submitted_at`) |
| Late submissions | `SHIPPED` (`allow_late`, `late_until`, `is_late`) |
| Marks | `SHIPPED` (`max_marks` / `marks_awarded`) |
| Teacher feedback | `SHIPPED` |
| Student submissions (portal) | `FUTURE` (`submitHomeworkAsStudentAction` stub) |
| Parent visibility | `SHIPPED` (`parent_visible` + `listStudentHomeworkAction`) |
| Future AI evaluation | Schema + queue stub (`ai_evaluation_*`) |

### 50.2 Tables

Enriched `homework_assignments` · `homework_submissions` · `homework_audit_log`

### 50.3 API

`createHomeworkAction` · `updateHomeworkAction` · `publishHomeworkAction` · `closeHomeworkAction` · `archiveHomeworkAction` · `setHomeworkParentVisibilityAction` · `recordHomeworkSubmissionAction` · `gradeHomeworkSubmissionAction` · `submitHomeworkAsStudentAction` (FUTURE) · `requestHomeworkAiEvaluationAction` (stub) · `listHomeworkAction` · `getHomeworkAction` · `listHomeworkSubmissionsAction` · `listStudentHomeworkAction` · `listHomeworkAuditAction`

### 50.4 Tests

`npx tsx scripts/smoke-homework-validation.ts`

### 50.5 Placement rule

Homework marks are **not** Assessment `exam_results`. Formal exams stay E11. Teacher Workspace homework panel reads the same table. Media bytes stay E27.

---

## 51. Phase 2 — Student Analytics Engine

**Status:** Backend `SHIPPED` (2026-08-07). UI `NOT BUILT`. **No AI** — deterministic rules only.  
**Canonical doc:** [`docs/architecture/student-analytics-engine.md`](architecture/student-analytics-engine.md)  
**Module:** `lib/student-analytics/**`  
**Owner:** **E22 Analytics** (student slice)  
**Migration:** `supabase/migrations/20260807320000_student_analytics_engine.sql` (pushed)  
**Workflows:** WF-PRI-01 · WF-VP-01 · WF-ADM-08 · WF-PAR-06 (consume)

### 51.1 Aggregates

| Aggregate | Status | Source |
|-----------|--------|--------|
| Attendance | `SHIPPED` | E12 `attendance_records` |
| Assessment performance | `SHIPPED` | E11 `exam_results` |
| Subject trends | `SHIPPED` | Grouped marks + trend delta |
| Participation | `SHIPPED` | E17 `event_participants` |
| Behaviour | `SHIPPED` | E13 `conduct_incidents` |
| Achievements | `SHIPPED` | Awards + commendations + high averages |
| Teacher remarks | `SHIPPED` | Assessment / behaviour / homework feedback |

### 51.2 Generated outputs

| Output | Status |
|--------|--------|
| Strengths | `SHIPPED` (`deriveInsights`) |
| Weaknesses | `SHIPPED` |
| Risk indicators | `SHIPPED` (+ year rollup action) |
| Progress graphs | `SHIPPED` (monthly attendance, by-exam, subject series) |
| AI narration | `NOT IN SCOPE` (E23 later) |

### 51.3 Tables

`student_analytics_snapshots` · `student_analytics_audit_log`

### 51.4 API

`generateStudentAnalyticsAction` · `getLatestStudentAnalyticsSnapshotAction` · `listStudentAnalyticsSnapshotsAction` · `listStudentRiskIndicatorsAction` · `buildStudentAnalyticsReport` · `deriveInsights`

### 51.5 Tests

`npx tsx scripts/smoke-student-analytics-validation.ts`

### 51.6 Placement rule

Never writes OLTP facts. Snapshots are regenerate-able marts. Thresholds live in `ANALYTICS_THRESHOLDS`. E23 may narrate later but must not invent scores.

---

## 52. Phase 2 — Teacher Analytics Engine

**Status:** Backend `SHIPPED` (2026-08-07). UI `NOT BUILT`. AI insights `FUTURE` (placeholder).  
**Canonical doc:** [`docs/architecture/teacher-analytics-engine.md`](architecture/teacher-analytics-engine.md)  
**Module:** `lib/teacher-analytics/**`  
**Owner:** **E22 Analytics** (teacher slice)  
**Migration:** `supabase/migrations/20260807330000_teacher_analytics_engine.sql` (pushed)  
**Workflows:** WF-PRI-01 · WF-PRI-05 · WF-HOD-01 · WF-TCH-11

### 52.1 Capabilities

| Capability | Status |
|------------|--------|
| Attendance completion | `SHIPPED` |
| Assessment completion | `SHIPPED` |
| Homework completion | `SHIPPED` |
| Average student performance | `SHIPPED` |
| Teacher workload | `SHIPPED` |
| Classes taught | `SHIPPED` |
| Department contribution | `SHIPPED` |
| Future AI insights | Placeholder (`aiInsights.status=not_built`) |

### 52.2 Tables

`teacher_analytics_snapshots` · `teacher_analytics_audit_log`

### 52.3 API

`generateTeacherAnalyticsAction` · `getLatestTeacherAnalyticsSnapshotAction` · `listTeacherAnalyticsSnapshotsAction` · `listTeacherWorkloadRisksAction` · `buildTeacherAnalyticsReport` · `deriveTeacherInsights`

### 52.4 Tests

`npx tsx scripts/smoke-teacher-analytics-validation.ts`

### 52.5 Placement rule

Never writes OLTP facts. Scoped by `employment_id` + year. Companion to §51 student slice. E23 may narrate later.

---

## 53. Phase 2 — Principal Dashboard

**Status:** Backend aggregator + minimal UI `SHIPPED` (2026-08-07). **Wave 2 ops shell** `SHIPPED` (2026-08-12): Teachers / Students / Promote under `/dashboard/principal/*`. Principal persona login still `FUTURE`.  
**Canonical doc:** [`docs/architecture/principal-dashboard.md`](architecture/principal-dashboard.md) · ops writers in `lib/principal-ops/**`  
**Module:** `lib/principal-dashboard/**` · `lib/principal-portal/**` · `lib/principal-ops/**`  
**UI:** `/dashboard/principal` (+ `/teachers`, `/students`, `/promote`)  
**Migration:** none (read-only panels; Wave 2 writes reuse employment / admission / placement tables)  
**Workflows:** WF-PRI-01 (overview) · WF-PRI-10 (promote) · teacher/student school ops

### 53.1 Panels (all data-driven)

| Panel | Status | Notes |
|-------|--------|-------|
| School attendance | `SHIPPED` | Present rate + section gaps today |
| Teacher attendance | `SHIPPED` | Marking-completion proxy; staff biometric FUTURE |
| Student performance | `SHIPPED` | Published marks averages |
| Department performance | `SHIPPED` | Members / subjects / mark averages |
| Upcoming events | `SHIPPED` | Approved/published calendar |
| Pending approvals | `SHIPPED` | Events, leave, conduct, draft marks |
| Pending report cards | `SHIPPED` | Draft `report_card_issues` |
| Pending assessments | `SHIPPED` | Draft sessions + exams without results |
| Notifications | `SHIPPED` | Recent delivery requests |
| School health indicators | `SHIPPED` | Deterministic composite |

### 53.2 API

`getPrincipalDashboardAction` · `buildPrincipalDashboard`  
Wave 2: `listPrincipalTeachersAction` · `endTeacherEmploymentAction` · `setEmploymentSubjectsAction` · `setSectionClassTeacherAction` · `listPrincipalStudentsAction` · `withdrawStudentAction` · `listPromotionCandidatesAction` · `applyPromotionBatchAction`

### 53.3 Tests

`npx tsx scripts/smoke-principal-dashboard-validation.ts`  
`npx tsx scripts/smoke-principal-portal-validation.ts`  
`npx tsc --noEmit`

### 53.4 Placement rule

Overview panels never write OLTP. Wave 2 mutations live in `lib/principal-ops/**` and call membership sync + owning tables (employment / admission / `student_academic_years`). Empty panels when no rows. Teacher attendance is not staff presence until E12 staff attendance ships.

### 53.5 Wave 2 notes

- Teachers: end employment (`left_on` + status ended), subjects with timetable overwrite force, class-teacher assign with overwrite force
- Students: withdraw/expel → admission `withdrawn`, placements closed, membership synced
- Promote: batch promote/repeat/graduate against published `promotion_rules` (guidance; principal decision authoritative)

### 53.6 Wave 4 notes

- `/dashboard/principal/enroll` — multi-select + CSV section placement; roll strategies via `lib/enrollment/**`
- D14/D15 affiliation guards applied on student/staff writers (see §68.7)

---

## 54. Phase 2 — Operations audit

**Status:** Audit `SHIPPED` (2026-08-07). Phase 2 backends **SHIPPED** (§41–§53). Production gate **NOT PASSED**. Phase 2 **not marked COMPLETE**.  
**Canonical doc:** [`docs/operations/phase2-audit.md`](operations/phase2-audit.md)

### 54.1 Verdict

| Gate | Result |
|------|--------|
| Workflow catalogue + engines §41–§53 backends | PASS |
| Validation smokes §15.22–§15.34 | PASS |
| Ownership / anti-duplication | PASS (with notes) |
| Production-ready (ops UI, notify chains, Fee/portals, Phase 1 gate) | **FAIL** |
| Mark Phase 2 COMPLETE | **No** |
| AuthN (§55) / AuthZ (§56) | **PASS** (post-audit) |

Safe for continued ops backend work under permission keys. Block Fee/send/portals GA and “Phase 2 COMPLETE” until remaining P0 closed (or waived in writing).

### 54.2 Critical / high themes

- ~~Profile-only AuthZ + F11~~ → **closed** by §55 / §56 (portals still open)
- Ops UIs missing for attendance, marks, report cards, behaviour, events, homework, compose
- Domain → notify unwired (`attendance.absent_alert`, `assessment.results_published`, `conduct.incident`)
- E19 providers stubbed; delivery retry worker missing
- Fee / Payments / Health / portals not in Phase 2 ship set
- Principal dashboard N+1; communication fan-out per-recipient enrichment
- Engine audits not bridged to unified E28
- Phase 1 production gate still open (§40) — ops inherit FK / archive risks
- `daily-workflows.md` maturity table stale vs shipped backends

### 54.3 P0 before claiming Phase 2 COMPLETE (or before Phase 3 GA)

See audit **§9 P2-P0-***: ops UIs (or explicit API-only waiver), wire notify chains, Phase 1 P0 accept/close. F11 + AuthZ platform closed in §55 / §56.

### 54.4 Placement rule

Do not mark Phase 2 COMPLETE in releases or Phase 3 kickoff decks. Phase 3 Fee/portal **design** may start with explicit dependency on §54 P0. Re-audit when the production gate flips.

---

## 55. Phase 2.5 — Authentication Platform

**Status:** AuthN platform `SHIPPED` (2026-08-07). Permissions live in §56.  
**Canonical doc:** [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md)  
**Module:** `lib/auth/**` · `lib/supabase/admin.ts`  
**Migration:** `supabase/migrations/20260807400000_authentication_platform.sql`  
**UI:** `/invite/accept` · `/activate/profile` · header school/persona switcher

### 55.1 Capabilities

| Capability | Status |
|------------|--------|
| F11 `intent=create_school` vs `accept_invite` | `SHIPPED` |
| `auth_invites` + create/revoke/resend | `SHIPPED` |
| Service-role invite adapter | `SHIPPED` (requires env key) |
| `membership_schools` + RLS cutover | `SHIPPED` |
| `user_active_context` switcher | `SHIPPED` |
| Profile completion → activate employment | `SHIPPED` |
| Staff onboarding → real invites | `SHIPPED` |
| E03 permission keys | **SHIPPED** (§56) |

### 55.2 Tests

`npx tsx scripts/smoke-auth-membership-validation.ts`  
`npx tsx scripts/smoke-auth-invite-validation.ts`  
`npx tsc --noEmit`

### 55.3 Placement rule

AuthN only for this section. Authorization is §56. Configure `SUPABASE_SERVICE_ROLE_KEY` for live invite emails.

---

## 56. Phase 2.6 — Authorization Platform

**Status:** AuthZ platform `SHIPPED` (2026-08-07).  
**Canonical doc:** [`docs/architecture/authorization-platform.md`](architecture/authorization-platform.md)  
**Matrix:** [`docs/architecture/rbac.md`](architecture/rbac.md)  
**Module:** `lib/authz/**`  
**Migration:** `supabase/migrations/20260807410000_authorization_platform.sql`  
**UI:** `<Can>` + permission-gated header nav; page loaders assert keys

### 56.1 Capabilities

| Capability | Status |
|------------|--------|
| Permission catalog (`{domain}.{resource}.{action}`) | `SHIPPED` |
| System role bundles + hierarchy grant rules | `SHIPPED` |
| `resolveActor` / `hasPermission` / ABAC ownership | `SHIPPED` |
| `requirePermission` on server actions | `SHIPPED` |
| SQL `has_permission(uid, school_id, key)` | `SHIPPED` |
| Custom roles + grant/revoke | `SHIPPED` |
| `<Can>` / bootstrap for nav | `SHIPPED` |
| Parent/student portal features | **NOT BUILT** |

### 56.2 Tests

`npx tsx scripts/smoke-authz-catalog-validation.ts`  
`npx tsx scripts/smoke-authz-evaluate-validation.ts`  
`npx tsx scripts/smoke-authz-action-gate.ts`  
`npx tsc --noEmit`

### 56.3 Placement rule

Every new server action must call `requirePermission` (or `getAuthenticatedSchoolContext(permission)`). Pages/nav use permission helpers — never `if (role === …)`. Do not claim multi-persona production readiness until portals + notify chains close.

---

## 57. Phase 2.7 — Membership Engine

**Status:** Membership platform `SHIPPED` (2026-08-07).  
**Canonical doc:** [`docs/architecture/membership-engine.md`](architecture/membership-engine.md)  
**Module:** `lib/membership/**`  
**Migration:** `supabase/migrations/20260807420000_membership_engine.sql`  
**UI:** Header school switcher (names + persona) via active membership preferences

### 57.1 Capabilities

| Capability | Status |
|------------|--------|
| `school_memberships` index + history | `SHIPPED` |
| `user_school_preferences` default/active | `SHIPPED` |
| Sync from employment / admission / parent / admin profile | `SHIPPED` |
| Switch school without second login | `SHIPPED` |
| Student transfer membership orchestration | `SHIPPED` |
| `consultant` / `substitute` employment types | `SHIPPED` (schema) |
| Parent/student portal product | **NOT BUILT** |

### 57.2 Tests

`npx tsx scripts/smoke-membership-validation.ts`  
`npx tsc --noEmit`

### 57.3 Placement rule

Writers that create person↔school links must call E29 sync. AuthN/AuthZ consume the membership index for school lists and RLS (`membership_schools`).

---

## 58. Phase 2.8 — Notification Operations

**Status:** Ops notify platform `SHIPPED` (2026-08-07). External providers stub-safe.  
**Canonical doc:** [`docs/architecture/notification-operations.md`](architecture/notification-operations.md)  
**Modules:** `lib/domain-events/` · `lib/notify-orchestration/` · `lib/notifications/`  
**Migration:** `supabase/migrations/20260807430000_notification_operations.sql`  
**UI:** `/dashboard/notifications` inbox · principal panel reuses delivery history

### 58.1 Capabilities

| Capability | Status |
|------------|--------|
| `domain_event_outbox` + `emitDomainEvent` | `SHIPPED` |
| Orchestrator event→type→audience→enqueue | `SHIPPED` |
| Emit hooks (attendance, assessment, behaviour, homework, events, report cards) | `SHIPPED` |
| Channel adapters + outbox worker + retry/dead-letter | `SHIPPED` |
| Cron route `/api/internal/notify-worker` | `SHIPPED` |
| Live WhatsApp/email/SMS/push | **STUB** until env keys |

### 58.2 Tests

`npx tsx scripts/smoke-notify-orchestration-validation.ts`  
`npx tsx scripts/smoke-notification-worker-validation.ts`  
`npx tsx scripts/smoke-notification-emit-gate.ts`  
`npx tsc --noEmit`

### 58.3 Placement rule

Domains emit facts only (`emitDomainEvent`). Never import providers or `enqueueDelivery` from attendance/assessment/etc. Process outbox via worker script/route or inbox flush.

---

## 59. Phase 2.9 — Teacher Portal

**Status:** Portal UI `SHIPPED` (2026-08-07); **Wave 1 daily ops** extended 2026-08-12 (Students tab, marks CSV + marking window, coordinator Events write, home-classroom attendance). Thin clients over Phase 2 engines; no parallel OLTP.  
**Canonical doc:** [`docs/architecture/teacher-portal.md`](architecture/teacher-portal.md)  
**Modules:** `lib/teacher-portal/` · `components/teacher-portal/` · `app/dashboard/teacher/**`  
**Entry gate:** `workforce.workspace.read`  
**Workflows:** WF-TCH-01 (attendance), WF-TCH-03 (remarks via Students/Behaviour), WF-TCH-05 (marks + CSV), events coordinator write (E17/E35) · see §68 Wave 1

### 59.1 Routes

| Route | Engine reuse | Permission |
|-------|--------------|------------|
| `/dashboard/teacher` | teacher-workspace | `workforce.workspace.read` |
| `/attendance` | attendance | `attendance.record.create` |
| `/students` · `/students/[studentProfileId]` | student roster + assessment + behaviour + events | `enrollment.admission.read` |
| `/marks` | assessment (+ CSV / marking window) | `assessment.results.enter` |
| `/homework` · `/homework/[id]` | homework | `homework.read` / assign |
| `/behaviour` | behaviour | `conduct.incident.record` |
| `/events` | events (coordinator write) | `engagement.event.read` (+ `create` to write) |
| `/announcements` | communications + departments | `communication.message.read` |
| `/resources` · `/department` | departments | `workforce.department.read` |
| `/profile` | identity / employment | `identity.person.read` |

### 59.2 RBAC rules

- Layout + pages use `requirePermission` / `<Can>` — never `role === 'teacher'`.
- Engine `assertEmploymentOwned` remains authoritative for writes.
- Admin preview via `?employment=` when actor has school-wide keys.
- Teacher bundle includes `engagement.event.create` + `assessment.results.publish` for Wave 1.
- Events participant writes are UI-gated on `event_staff_assignments` (coordinator).

### 59.3 Tests

`npx tsx scripts/smoke-teacher-portal-validation.ts`  
`npx tsc --noEmit`

### 59.4 Placement rule

Portal must not insert attendance/marks/homework outside owning `lib/*` engines. Homepage stays the aggregator (§43); feature pages are binders only.

### 59.5 Wave 1 notes

- Section pickers prefer `sections.class_teacher_id` (“Home classroom”), then timetable slots.
- `exam_subject_schedules.marking_opens_at` / `marking_closes_at` guard mark entry (null = open until session lock).
- Marks CSV: `lib/assessment/marks-csv.ts` (admission_number / profile id / name).

---

## 60. Phase 2.10 — Student Portal

**Status:** Portal UI `SHIPPED` (2026-08-07). Read-only-by-default; self-scoped over Student Profile + engines.  
**Canonical doc:** [`docs/architecture/student-portal.md`](architecture/student-portal.md)  
**Modules:** `lib/student-portal/` · `components/student-portal/` · `app/dashboard/student/**`  
**Entry gate:** `enrollment.admission.read`  
**Workflows:** WF-STU-02…06, WF-STU-09 (reads); submit/pay/AI not wired

### 60.1 Routes

| Route | Engine reuse | Mode |
|-------|--------------|------|
| `/dashboard/student` | student-profile + notifications | RO |
| `/attendance` | attendance (`visibleOnly`) | RO |
| `/homework` | homework (student list) | RO (no submit) |
| `/assessments` | assessment (`visibleOnly`) | RO |
| `/report-cards` | report-cards issues | RO |
| `/announcements` | `listMessagesForStudentAction` | RO |
| `/events` | events participations | RO |
| `/behaviour` | behaviour (`visibleOnly`) | RO |
| `/profile` · `/documents` · `/achievements` | student-profile modules | RO / stub |
| `/ai` | placeholder `not_built` | Placeholder |

### 60.2 RBAC / scope

- Layout + pages: `requirePermission` / `<Can>` — never `role === 'student'`.
- Linked `auth_user_id` → own profile; staff preview via `?studentProfileId=` only.
- Write allowlist v1 empty (`STUDENT_PORTAL_WRITE_ALLOWLIST`).
- Student bundle includes `conduct.incident.read` for visible remarks.

### 60.3 Tests

`npx tsx scripts/smoke-student-portal-validation.ts`  
`npx tsc --noEmit`

### 60.4 Placement rule

Portal must not duplicate Student Profile OLTP or school-wide directories. Prefer engine query actions with visibility flags.

---

## 61. Phase 3 — Curriculum Engine

**Status:** Backend `SHIPPED` (2026-08-07). Full HOD/Teacher curriculum portal UI `NOT BUILT` (actions-first).

**Canonical doc:** [`docs/architecture/curriculum-engine.md`](architecture/curriculum-engine.md)

### 61.1 Scope

- Packs: academic year × optional board × class (grade) × subject
- Hierarchy: units → chapters → topics → subtopics + LOs / competencies / resources / notes
- Publish → immutable `curriculum_versions.snapshot`; progress pins `curriculum_version_id`
- AuthZ: `curriculum.*` keys; teacher read+progress; HOD+ full set
- Module: `lib/curriculum/**` · Migration `20260807440000_curriculum_engine.sql`

### 61.2 Placement rule

Assessments, lesson progress, report cards, and AI **reference curriculum version ids** — do not duplicate chapter trees. `class_subjects` (E07) remains the offer map.

### 61.3 Tests

`npx tsx scripts/smoke-curriculum-validation.ts`  
`npx tsc --noEmit`

### 61.4 Non-goals (this ship)

AI generation, LessonPlan entity, exam↔topic binding UI, full portal screens, auto-migrate `subjects.chapter_map`.

---

## 62. Phase 3 — Assessment Framework Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI `NOT BUILT` (actions-first).

**Canonical doc:** [`docs/architecture/assessment-framework-engine.md`](architecture/assessment-framework-engine.md)

### 62.1 Scope

- Frameworks: academic year × class × subject evaluation plans
- Categories: Term Exam, Half Yearly, Final, Periodic, Notebook, Classwork, Practical, Project, Viva, Observation, Internal, Activity (+ custom)
- Per category: weightage, max/pass marks, grade mapping, included-in-final, term, visibility, report-card mapping
- Multiple formulas (e.g. Term 1 = 50% Classwork + 30% Periodic + 20% Practical)
- Publish → immutable versions; clone prior years
- AuthZ: teachers **read only**; admin/HOD write/publish/clone
- Module: `lib/assessment-framework/**` · Migration `20260807450000_assessment_framework_engine.sql`

### 62.2 Placement rule

Teachers do **not** design assessments — they enter evidence against the published framework via **E32** Assessment Recording. Marks and report cards should pin `assessment_framework_version_id`. E11 exam catalogs/defs remain separate; E31 is the year evaluation plan SoT.

### 62.3 Tests

`npx tsx scripts/smoke-assessment-framework-validation.ts`  
`npx tsc --noEmit`

### 62.4 Non-goals (this ship)

Teacher-authored frameworks, live grade computation UI, full admin portal, auto-binding existing exam_definitions.

---

## 63. Phase 3 — Assessment Recording Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher Portal wiring `NOT BUILT` (actions-first).

**Canonical doc:** [`docs/architecture/assessment-recording-engine.md`](architecture/assessment-recording-engine.md)

### 63.1 Scope

- Teachers create **evidence** under E31 framework categories (unlimited Class Tests / Worksheets / Observations / …)
- Fields: title, date, class, section, subject, category, max marks, description, curriculum topics/LOs, students, marks, remarks, attachments
- Bulk mark entry; edit until locked; Admin/HOD lock/unlock
- Marks **append-only** (supersede history — never overwrite)
- Module: `lib/assessment-recording/**` · Migration `20260807460000_assessment_recording_engine.sql`

### 63.2 Placement rule

Teachers never create academic structures (that is E31). E11 ops remains for legacy scheduled exams; new framework-bound evidence should use E32.

### 63.3 Tests

`npx tsx scripts/smoke-assessment-recording-validation.ts`  
`npx tsc --noEmit`

### 63.4 Non-goals (this ship)

Formula rollup UI, full portal screens, auto-migrate `exam_results` into E32.

---

## 64. Phase 3 — Grade Calculation Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin UI `NOT BUILT` (actions-first).

**Canonical doc:** [`docs/architecture/grade-calculation-engine.md`](architecture/grade-calculation-engine.md)

### 64.1 Scope

- Teachers **never** calculate grades manually
- Reads: E31 framework (weightages/formulas), E32 locked marks, grace rules, optional subjects, exemptions, grade bands
- Produces: final marks, letter grade, grade points, subject / term / overall results
- Every run stores `input_snapshot` + `inputs_fingerprint` for reproducibility
- Re-run supersedes prior current results — never silent overwrite
- Module: `lib/grade-calculation/**` · Migration `20260807470000_grade_calculation_engine.sql`

### 64.2 Placement rule

E31 = plan, E32 = evidence, **E33 = computed results**. E20 report cards should pin published E33 run ids.

### 64.3 Tests

`npx tsx scripts/smoke-grade-calculation-validation.ts`  
`npx tsc --noEmit`

### 64.4 Non-goals (this ship)

Full gradebook UI, auto-promotion, live recalculation on every mark keystroke.

---

## 65. Phase 3 — Report Card Engine

**Status:** Backend `SHIPPED` (2026-08-07). Admin template designer UI `NOT BUILT`. PDF / digital signatures `FUTURE`.

**Canonical doc:** [`docs/architecture/report-card-engine.md`](architecture/report-card-engine.md)

### 65.1 Scope

- Admin configures templates first (boards, scopes by grade/class, blocks, field assignments, signatures)
- **Never** store duplicated academic information — assemble by reference
- Sources: E33 assessment results, attendance, teacher remarks/fields, behaviour, co-curricular, achievements, promotion, curriculum completion, observation records
- Teachers only fill **assigned** narrative fields (`document.report_card.fill`)
- Multiple templates; different templates per class/section scope
- Lifecycle: **draft → published → locked** (+ historical versions; legacy `issued` ≡ published)
- Module: `lib/report-cards/**` · Migration `20260807480000_report_card_engine_phase3.sql`

### 65.2 Placement rule

E31 = plan, E32 = evidence, E33 = computed results, **E20 = document assembly**. Presentation snapshot is reprint-only — not a second marks store.

### 65.3 Tests

`npx tsx scripts/smoke-report-card-phase3-validation.ts`  
`npx tsx scripts/smoke-report-card-ops-validation.ts`  
`npx tsc --noEmit`

### 65.4 Non-goals (this ship)

Drag-and-drop designer UI, PDF bytes, DigiLocker, crypto digital signatures.

---

## 66. Phase 3 — Student Observation Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher UI `NOT BUILT`. AI provider `FUTURE` (queue stub only).

**Canonical doc:** [`docs/architecture/student-observation-engine.md`](architecture/student-observation-engine.md)

### 66.1 Scope

- Teachers record structured observations throughout the year
- Categories: Academic, Behaviour, Participation, Leadership, Creativity, Communication, Reading, Writing, Speaking, Discipline, Social Skills, + custom
- Fields: date, teacher, subject, category, remark, visibility, term, academic year
- Students **accumulate** observations — **nothing overwritten** (append-only; supersede = new row)
- Filtering by year/term/category/subject/teacher/visibility/date range
- FUTURE AI summaries: queue stub only (no LLM calls)
- Module: `lib/observations/**` · Migration `20260807490000_student_observation_engine.sql`

### 66.2 Placement rule

E34 owns developmental observations. E13 owns discipline incidents. E32 owns assessment evidence. E20 report cards prefer E34 for the observations block.

### 66.3 Tests

`npx tsx scripts/smoke-student-observation-validation.ts`  
`npx tsc --noEmit`

### 66.4 Non-goals (this ship)

Teacher observation UI, live AI summarization, merging E13/E34 stores.

---

## 67. Phase 3 — Student Achievement Engine

**Status:** Backend `SHIPPED` (2026-08-07). Teacher UI `NOT BUILT`. AI provider `FUTURE` (queue stub only).

**Canonical doc:** [`docs/architecture/student-achievement-engine.md`](architecture/student-achievement-engine.md)

### 67.1 Scope

- School activities originate from the **Academic Calendar** (E17 `calendar_events`)
- Teachers record participation, attendance, role, award, position, certificate, points, remarks, photos, attachments
- Permanent profile projection on `student_achievements` — **no duplicated event SoT**
- Auto-sync from event participant upsert; manual awards supported
- Appears in Student Profile, Report Cards, Timeline, future AI summaries
- Module: `lib/achievements/**` · Migration `20260807500000_student_achievement_engine.sql`

### 67.2 Placement rule

E17 = live event ops. **E35 = permanent achievement profile.** E20 / Student Profile read by reference.

### 67.3 Tests

`npx tsx scripts/smoke-student-achievement-validation.ts`  
`npx tsc --noEmit`

### 67.4 Non-goals (this ship)

Teacher achievement UI, live AI summarization, DigiLocker certificates.

---

## 68. Product use-case roadmap

**Status:** Living product plan (2026-08-12). Maps school admin / teacher / principal / student-parent / super-admin use cases onto shipped engines.  
**Companion:** CreatePlan `use_case_roadmap` · WF-* in [`docs/operations/daily-workflows.md`](operations/daily-workflows.md)

### 68.1 Persona mapping

| Use-case term | Product mapping |
|---------------|-----------------|
| Teacher / class teacher / subject teacher | `teacher` AuthZ bundle + employment + timetable / section scope |
| HOD | `hod` bundle + department membership / `is_hod` |
| Principal = school admin | Principal / school_admin permissions (school-wide) |
| Student = parent (RO) | Student Portal SHIPPED; Parent F10 SHIPPED (Wave 6) |
| Super admin | RBAC design only — platform console Wave 6 |

### 68.2 Identity mapping

Use-case “master” rows = global `persons` + `teacher_profiles` / `student_profiles` + school links (`teacher_employments` / `student_admissions`). Aadhaar = hash/last4 match ([`lib/identity/aadhaar.ts`](../lib/identity/aadhaar.ts)), not UIDAI live verify until contracted.

### 68.3 Delivery waves

| Wave | Focus | Primary modules / WF |
|------|-------|----------------------|
| **0** | Docs + locked rules (this §) | MASTER §4 D12–D17 |
| **1** | Teacher daily: Students tab, marks CSV + marking window, coordinator Events write, home-classroom attendance | §59 · WF-TCH-01, 03, 05 · `lib/teacher-portal/` · **SHIPPED 2026-08-12** |
| **2** | Principal: teacher assignment overwrite validation, promote, expel | §53 · WF-PRI-* · `lib/principal-ops/` · **SHIPPED 2026-08-12** |
| **3** | Config hub = onboarding steps as editable tabs + school code | §39 · `lib/config-dashboard/hub-tabs.ts` · **SHIPPED 2026-08-12** |
| **4** | Enrollment / roll sort-random / house CSV / affiliation messaging | `lib/enrollment/**` · `lib/workforce/employment-guards.ts` · **SHIPPED 2026-08-12** |
| **5** | Dated exam schedules, report-card designer UI, Google-like calendar, rubrics | `lib/assessment/**` · `lib/report-cards/**` · calendar grid · **SHIPPED 2026-08-13** |
| **6** | Career profile, self join/leave, Parent F10, super-admin (xlsx/UIDAI deferred) | `lib/workforce/career-actions.ts` · `/dashboard/parent` · `/dashboard/platform` · **SHIPPED 2026-08-13** |

### 68.4 Wave 1 ship notes

- `/dashboard/teacher/students` — scoped roster + student sheet (marks in open window, remarks, event participation)
- Marks CSV upload + `exam_subject_schedules.marking_opens_at` / `marking_closes_at` guard (session lock still applies)
- Events coordinator write gated on `event_staff_assignments` + `engagement.event.create`
- Attendance prefers `sections.class_teacher_id` (“Home classroom”)

### 68.5 Wave 2 ship notes

- Principal portal shell: Overview / Teachers / Students / Promote
- Teachers: end employment, subjects with timetable force-overwrite, class-teacher force-overwrite
- Students: withdraw/expel → admission `withdrawn` + membership sync
- Promote batch: promote / repeat / graduate (WF-PRI-10); `promotion_rules` shown as guidance

### 68.6 Wave 3 ship notes

- Config hub at `/dashboard/configuration?tab=*` — Health + school identity + terms + structure checklist; outbound admin links for remaining onboarding steps
- `schools.code` + branding edit (onboarding + hub); catalog hrefs avoid `/onboarding/*` after go-live
- Term count lock + date vs calendar-event conflict checks (`term-edit-guards` → `terms-actions`)
- Structure completeness checklist (subjects offered, class teachers, students placed)
- Subject rename on `/dashboard/subjects`; houses/clubs deep-links `#houses` / `#clubs`

### 68.7 Wave 4 ship notes

- `/dashboard/principal/enroll` — multi-select + CSV section placement; roll strategies (sequential / first|last name sort / random)
- House membership CSV (`admission_number`, `house_code`, `role`) + unassigned flash on `/dashboard/houses-clubs`
- D14: global one-active-admission guard + unique index; wired into `saveStudentsAction`
- D15: cross-school active/invited employment guard + messaging on staff create + invite; global unique active employment index
- Smoke: `scripts/smoke-enrollment-wave4-validation.ts`

### 68.8 Wave 5 ship notes

- `/dashboard/assessments` — dated subject schedules (start/end, marking window, section, period, half/full day) + rubric builder (`assessment_rubrics` / criteria)
- `/dashboard/report-cards` — template designer (create/publish/retire/clone, blocks, class/section scopes)
- Calendar week/month grid on `/dashboard/calendar` (holidays / events / competitions)
- Config hub + catalog hrefs point at assessments / report-cards
- Smoke: `scripts/smoke-assessment-wave5-validation.ts`

### 68.9 Wave 6 ship notes

- First-login career fields on `/activate/profile` + teacher Profile career editor / experience history / self-leave (`workforce.employment.self_end`)
- Parent F10 RO portal `/dashboard/parent/**` (linked children via `resolveStudentPortalContext`); guardian email → `createInviteAction(parent)` on student save
- Platform console `/dashboard/platform` (`platform_operators` + audit + optional impersonate)
- Deferred: `.xlsx` importer, UIDAI live Aadhaar verify
- Smoke: `scripts/smoke-wave6-identity-validation.ts`

### 68.10 Post–Wave cleanup (2026-08-13)

Dropped unused DB stubs/cutover maps via `20260807560000_cleanup_unused_stubs.sql`:
`house_point_ledger`, `subject_textbooks`, `timetable_substitutions`, `teacher_subject_assignments`, `student_id_map`, `teacher_id_map`, and RPC `list_memberships_for_uid`.

Removed orphan app code: `chip-list`, config club-membership re-export, unused workspace/config dashboard action wrappers, one-shot `inject-authz-permissions.py`.

---

*End of master document. Update §15 after verification; §3/§4/§8 on schema; §18–§68 through use-case roadmap. Phase 0.5 closed; Phase 1–2 backends shipped (gates open); AuthN + AuthZ + Membership + Notify + portals + Curriculum + Assessment Framework + Recording + Grade Calculation + Report Card + Student Observation + Student Achievement shipped; **Use-case Waves 0–6 shipped 2026-08-12/13**. Remaining: production gates, Fee, xlsx/UIDAI if contracted.*
