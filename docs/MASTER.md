# FeezypayERP — Master Technical Document

> **Living document.** Update this file whenever architecture, auth, onboarding, schema, tests, or forward plans change. This is the single source of truth for planning the next phase.
>
> **Last updated:** 2026-08-07 (Phase 1 — Implementation Audit)  
> **Repo:** `https://github.com/Tushar-Anand-Vardhan/FeezypayERP.git`  
> **Stack:** Next.js 16 · React 19 · Tailwind 4 · Supabase (Auth + Postgres + RLS)  
> **Linked Supabase project:** `xjuudcnexvbtgknbfdfw`  
> **Branch tip at last verification:** `main` @ `f78b48a` (+ Phase 1 engines §28–§39; audit §40)  
> **Current phase:** **Phase 1 engines SHIPPED (§28–§39). Production gate NOT PASSED — Phase 1 not marked COMPLETE.** See [`docs/architecture/phase-1-implementation-audit.md`](architecture/phase-1-implementation-audit.md) + §40. Next: P0 hardening (same-school FKs, DELETE revoke, year lifecycle, editing adoption, seed-on-create, audit retention) then remaining §26 P0 (F11, membership RLS, outbox, Fee, rollover).

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
9. [Onboarding wizard](#9-onboarding-wizard)
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
| New feature PR | Must name owning engine + entity + events + AuthZ + versioning + audit + notify + AI + persona; respect §26 P0; update maturity if shipping |

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
| D1 | Staff passwords | Attempt `resetPasswordForEmail` after staff save. **Only works for emails that already have Auth users.** No service-role invite yet. |
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

---

## 5. Tenancy model

### 5.1 What is a tenant?

One row in `public.schools`. All school-scoped data hangs off `school_id` (directly or via `academic_years` / admissions / employments).

### 5.2 How a tenant is born

On `auth.users` **INSERT**, trigger `handle_new_user` (`20260731120100_handle_new_user_trigger.sql`):

1. Inserts a new `schools` row (default name / `onboarding_status = in_progress`).
2. Inserts `profiles (id = auth.users.id, role = 'school_admin', school_id = new school)`.

**Implication:** every `/signup` creates a **new school**. There is no “join existing school” path today.

### 5.3 App school context

Server actions use `getAuthenticatedSchoolContext()` (`lib/onboarding/server-context.ts`):

1. Resolve `auth.uid()` via Supabase server client.
2. Read `profiles.school_id` for that user.
3. Return `{ supabase, schoolId }` or an error.

All onboarding writes must filter by this `schoolId`.

---

## 6. Authentication — current (school admin only)

**Status:** `SHIPPED` for school admins only.

### 6.1 Clients

| Layer | File | Notes |
|-------|------|-------|
| Browser | `lib/supabase/client.ts` | `createBrowserClient` + anon key |
| Server | `lib/supabase/server.ts` | `createServerClient` + cookie bridge |
| Middleware | `lib/supabase/middleware.ts` + root `middleware.ts` | Refreshes session; enforces protected routes |

No service-role / admin API client in application code.

### 6.2 Routes & handlers

| Path | File | Behavior |
|------|------|----------|
| `/signup` | `app/(auth)/signup/page.tsx` | `signUp({ email, password })` → session? then post-auth dest : `/signup/confirm` |
| `/signup/confirm` | `app/(auth)/signup/confirm/*` | Resend signup confirmation |
| `/login` | `app/(auth)/login/page.tsx` | `signInWithPassword` → post-auth dest (**does not** currently honor `?next=`) |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | `resetPasswordForEmail` → `/auth/confirm?next=/reset-password` |
| `/reset-password` | `app/(auth)/reset-password/*` | Requires recovery session; `updateUser({ password })`; sign out → login |
| `/auth/confirm` | `app/auth/confirm/route.ts` | `exchangeCodeForSession` **or** `verifyOtp({ token_hash, type })` |
| `/auth/callback` | `app/auth/callback/route.ts` | PKCE `exchangeCodeForSession` |
| Logout | `components/dashboard/app-header.tsx` | `signOut()` → `/login` |

Validation helpers: `lib/auth/validation.ts`.

### 6.3 Post-auth destination

`lib/auth/routing.ts`:

```text
onboarding_status === 'completed'  →  /dashboard
otherwise                          →  /onboarding   (index resumes earliest incomplete step)
```

### 6.4 Middleware protection

1. Unauthenticated hit to `/dashboard` or `/onboarding/*` → `/login?next=<path>`.
2. Authenticated on auth pages → bounce to post-auth destination.
3. Completed schools on `/onboarding/[step]` → `/dashboard` (exact `/onboarding` allowed so resume redirect can run).
4. **Dashboard is allowed during onboarding** (Save & Exit).

### 6.5 `profiles` constraints (today)

- `profiles.role` check allows **only** `'school_admin'`.
- Authenticated users cannot change `role` or `school_id` (RLS).
- Expanding roles requires a migration + auth product work (§7).

### 6.6 Teacher password emails (current hack)

After `saveStaffAction`, for each saved email the app calls `resetPasswordForEmail`. Success copy states emails only arrive for addresses that **already** exist in Auth. This is **not** an invite system.

---

## 7. Authentication — future (teachers, students, parents) + RBAC

**Status:** `SCHEMA-READY` / product `NOT BUILT`.

### 7.1 Schema already present

| Piece | Purpose |
|-------|---------|
| `persons.auth_user_id` → `auth.users` (unique when set) | Attach login identity to global person |
| `persons.profile_completed_at` | Gate first-login wizard |
| `person_roles (person_id, role)` | `teacher \| student \| parent \| admin` — multi-role humans |
| `teacher_employments.status` includes `invited` | Pre-active hire state |
| RLS self-access | `persons.auth_user_id = auth.uid()` on SELECT/UPDATE |

### 7.2 Planned invite → first login (teachers first)

Documented also in [`deferred-identity-followups.md`](deferred-identity-followups.md) §6:

1. School admin invites teacher (email) during/after staff step.
2. Create/reuse `persons` + `teacher_profiles`; employment `status = invited`.
3. Send Auth invite / magic link / password setup (**needs service role or Supabase Invite API** — not in app today).
4. On first auth success: set `persons.auth_user_id = auth.uid()` (1:1).
5. If `profile_completed_at IS NULL` → force profile wizard (phone, photo, career fields on `teacher_profiles`).
6. Wizard completion → `profile_completed_at = now()`, employment `invited` → `active`.
7. Repeat pattern for parents/students later.

### 7.3 Critical design tension: signup trigger vs non-admin users

Today `handle_new_user` **always** creates a new school + `school_admin` profile. That is correct for SaaS school signup and **wrong** for invited teachers/parents/students.

**Forward plan (must implement before invite GA):**

| Actor | Auth creation | `profiles` row? | School binding |
|-------|---------------|-----------------|----------------|
| New school owner | `/signup` | Yes — `school_admin` | Trigger creates school |
| Invited teacher | Invite / magic link | Either expand `profiles.role` **or** stop using `profiles` for non-admins and authorize via `persons` + `person_roles` + employments | Employment `school_id` |
| Parent / student | Invite / guardian link | Same decision as teachers | Admission / parent link |

**Recommended direction (not locked — plan carefully):**

1. Change `handle_new_user` to only create school when signup metadata says `intent=create_school` (or similar).
2. Invited users: create Auth user without new school; link `persons.auth_user_id`.
3. Introduce **RBAC** as a separate layer (§7.4).

### 7.4 RBAC roadmap

**Today:** implicit RBAC = “if you have a `profiles` row you are school_admin of that school.”

**Target model:**

```text
auth.users
   └── persons.auth_user_id
         └── person_roles[]          (capability classes: teacher, student, parent, admin)
         └── teacher_employments[]   (school-scoped job; status; department; subjects)
         └── student_admissions[]    (school-scoped enrollment relationship)
         └── student_parent_links    (via parent_profiles)

Authorization decision ≈
  auth.uid()
    → person
    → roles + active school links
    → permission check for resource.school_id
```

**Phases (suggested):**

| Phase | Work | Depends on |
|-------|------|------------|
| RBAC-0 | Keep school_admin via `profiles` (current) | — |
| RBAC-1 | Invite teachers; attach `persons.auth_user_id`; first-login wizard | Trigger split (§7.3) |
| RBAC-2 | Permission matrix — **canonical:** [`docs/architecture/rbac.md`](architecture/rbac.md) | RBAC-1 |
| RBAC-3 | Parent portal (read child admissions / fees / results) | Admissions + parent links |
| RBAC-4 | Student portal (limited self read) | Admissions + age/consent rules |
| RBAC-5 | Multi-role sessions (teacher who is also parent at same/other school) | `person_roles` already supports multi-role |
| RBAC-6 | Custom school roles + accountant persona | E03 permission catalog |

**Do not** grant school admins unrestricted `SELECT` on all `persons` — current RLS links visibility through employments/admissions only (§12).

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
| `subject_textbooks` | subject | FUTURE multi-textbook rows |
| `class_subjects` | class↔subject | elective flag per class offer map |
| `houses`, `clubs` | school | E07 catalog; colour, logo_path, description, year scope, TIC employment |
| `house_memberships` | house | member/captain/vice_captain ↔ student; dated; syncs `admission.house_id` |
| `club_memberships` | club | member/captain/vice_captain; year-scoped; dated |
| `house_point_ledger` | house | FUTURE points (schema-ready) |
| `club_event_links` | club | FUTURE event/competition links to E17 |
| `departments` | school | E05 org unit; code, archive, `created_by`/`updated_by`; never stores teachers |
| `department_memberships` | department | head / coordinator / member ↔ `teacher_employments` |
| `department_subjects` | department | Org links to E07 `subjects` |
| `department_teaching_assignments` | department | Employment↔subject relationships (not E10) |
| `department_announcements` | department | Draft/publish; notify stub |
| `department_resources` | department | Links/notes; media stub |
| `department_history` | department | Append-only edit trail |
| `period_definitions` | year | E10 bell periods; break/lock/archive |
| `timetable_grids` | year | primary / alternate / exam / special |
| `timetable_cycle_days` | grid | cycle day labels + weekday mapping |
| `timetable_slots` | section×grid | subject + teacher employment; room stub; locks |
| `teacher_availability` | employment×year | free/busy blocks |
| `section_availability` | section×year | free/busy blocks |
| `rooms` | school | FUTURE room catalog |
| `timetable_substitutions` | slot×date | FUTURE substitute overlays |
| `teacher_subject_assignments` | section | schedule planning map |
| `exam_definitions` | year | type/category FKs, weightage, max/pass marks, grading, publish/lock, archive |
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
| 10 | `exams` | `ExamsForm` | `exams-review-actions.ts` | Yes (blocks wipe if existing) | ≥1 exam | No |
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
- Attempt password reset emails for listed emails.

### 10.4 Student save semantics (intended / fixed)

- Diff by **admission_number** within school.
- Reactivate/update existing admission + current academic year row.
- Insert new admission+year when number is new.
- Soft-withdraw admissions removed from list.
- Never delete `persons`.
- Link primary guardian via parent person/profile + `student_parent_links`.

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

### 11.4 Exams & review

- `exam_definitions` per academic year (E11 config; soft-archive on onboarding rewrite).
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

| Route | Behavior |
|-------|----------|
| `/` | Session → `/dashboard`; else marketing |
| `/dashboard` | Allowed during onboarding; locked feature links + continue banner when incomplete |
| `/dashboard/configuration` | School setup command centre (completion, warnings, deps, health) |
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
| F2 | Append-only `exam_results` | `DEFERRED` | `student_academic_years` |
| F3 | Attendance | `DEFERRED` | admissions / academic years |
| F4 | Behaviour & remarks | `DEFERRED` | student profile + year |
| F5 | Health records | `DEFERRED` | `student_profiles` |
| F6 | Teacher invite + first-login wizard | `SCHEMA-READY` | §7 |
| F7 | Teacher marketplace / public profiles | `DEFERRED` | `teacher_profiles` |
| F8 | Transfers & certificates | `DEFERRED` | new admission/employment rows, never overwrite |
| F9 | Full RBAC matrix | Design `SHIPPED` in [`architecture/rbac.md`](architecture/rbac.md); runtime `NOT BUILT` | §7.4, §21 |
| F10 | Parent / student portals | `NOT BUILT` | §7 |
| F11 | Split signup trigger for invited users | `NOT BUILT` | §7.3 — **blocker for F6** |
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

---

## 16. Key file index

### Auth & routing

- `lib/auth/routing.ts`, `lib/auth/validation.ts`
- `lib/supabase/{client,server,middleware}.ts`
- `middleware.ts`
- `app/(auth)/**`, `app/auth/{confirm,callback}/route.ts`
- `app/page.tsx`, `app/dashboard/page.tsx`

### Onboarding

- `lib/onboarding/steps.ts`, `progress.ts`, `server-context.ts`, `csv.ts`
- `lib/onboarding/*-actions.ts`, `staff.ts`, `students.ts`, `timetable.ts`, `exams.ts`
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
- `lib/communications/**` ← Communication Configuration Engine module
- `scripts/smoke-communication-validation.ts`
- `docs/architecture/configuration-editing-framework.md` ← shared editing framework
- `lib/editing/**` ← Configuration Editing Framework
- `scripts/smoke-editing-validation.ts`
- `docs/architecture/configuration-dashboard.md` ← school setup command centre
- `lib/config-dashboard/**` ← Configuration Dashboard aggregator
- `app/dashboard/configuration/page.tsx` ← minimal command-centre UI
- `scripts/smoke-config-dashboard-validation.ts`
- `docs/architecture/phase-1-implementation-audit.md` ← Phase 1 production gate audit
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

**Action:** commit + push; apply pending migrations via `npx supabase db push`. Prioritize §40 P0 before production.

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

### 17.4 Next planning suggestions

1. Commit §17.1 deltas.  
2. **Phase 0.5 is complete** — treat §18–§27 + architecture docs as binding.  
3. **Phase 1 engines §28–§39 SHIPPED; production gate NOT PASSED (§40)** — do not mark Phase 1 COMPLETE until P0 hardening closes.  
4. Close **§40.3 P0** (FK integrity, archive purity, year lifecycle, editing adoption, seeds, audit retention) **or** continue admin-only build with explicit risk acceptance.  
5. Continue **§26 P0**: F11, membership RLS, outbox, Fee deep-dive, year-rollover — **before** Fee UI, portals, or WhatsApp.  
6. Spec **RBAC-1** teacher invite after F11 + membership RLS.  
7. Wire onboarding staff department creates through `lib/departments` + memberships (retire employment-only HOD flags as source of truth).  
8. Prefer `house_memberships` over writing `admission.house_id` alone.  
9. Department / assessment / policies / communications admin UIs after hardening.  
10. Event outbox for domain events after P0 outbox ships.  
11. Assessment **marks entry** (`exam_results`) remains deferred — config only (§34).  
12. Report card **PDF issue** / digital signatures remain deferred — templates only (§35).  
13. Fee / transport **policy runtime** remains deferred — kinds stubbed (§36).  
14. Communication **sending** (E19) remains deferred — config only (§37).  
15. Adopt **§38 editing framework** (`recordConfigMutation` / `evaluateConfigEdit`) in remaining config action modules.  
16. Re-audit and mark Phase 1 **COMPLETE** only when §40 production gate PASSes.

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

**Status:** Design-only (2026-08-06). Matrix is the ERP authorization contract; **runtime evaluator / expanded RLS not implemented** (today = school_admin via `profiles` only).

**Canonical doc:** [`docs/architecture/rbac.md`](architecture/rbac.md)

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

**Status:** Design-only (2026-08-06). **E19** delivery architecture; runtime `NOT BUILT`. Content/consent remain **E18**.

**Canonical doc:** [`docs/architecture/notification-engine.md`](architecture/notification-engine.md)

### 24.1 Boundary

```text
Domain event → E18 (template, audience, consent) → E19 (queue, channel, retry) → provider
```

Domain modules must **not** own WhatsApp/email/SMS/push SDKs.

### 24.2 Coverage

| Concern | Design |
|---------|--------|
| **Types** | Controlled codes (`fee.invoice_overdue`, `attendance.absent_alert`, …) |
| **Channels** | `in_app` first; then email, WhatsApp, push, SMS |
| **Recipients** | Resolvers (parent_of_admission, payer, section, …) via E18 |
| **Templates** | E18 versioned MessageTemplate; E19 maps provider template ids |
| **Priorities** | critical / high / normal / low (+ quiet hours) |
| **Scheduling** | Immediate, delayed, digests, cancel-on-void |
| **Triggers** | Catalogue events + announcements + cron reminders |
| **Retry** | Exponential backoff; hard bounce → no retry; dead letter |
| **Futures** | WhatsApp (Meta/BSP), Email (SES/etc.), Push (FCM/APNs), SMS (DLT) |

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

`house_point_ledger`, `club_event_links` (competitions / inter-house / club events → E17 later). Flags `points_tracking_enabled`, `events_enabled`.

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

`textbook_isbn`, `textbook_title`, `ai_lesson_plan_enabled`, `chapter_map` on subjects; `subject_textbooks` table for multi-book catalog.

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
| Periods | Upsert, archive, break flag, **lock/unlock** |
| Weekly schedule | `timetable_slots` with day_of_week + period |
| Cycle days | `timetable_cycle_days` per grid |
| Alternate timetables | `timetable_grids` types: primary / alternate / exam / special |
| Teacher allocation | Slot `teacher_id` → employment; conflict-checked |
| Section allocation | Slot `section_id`; unique per grid×day×period |
| Availability | `teacher_availability`, `section_availability` |
| Conflict detection | Pure `detectSlotConflicts` + enforced on upsert |
| Period / slot locking | Blocks mutations until unlocked |

### 33.2 Future (stubs)

`rooms`, `timetable_slots.room_id`, `timetable_substitutions`.

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

Onboarding `saveExamsAction` soft-archives then inserts (DELETE revoked). Prefer `lib/assessment/*-actions.ts` for ongoing admin config.

### 34.4 Tests

`npx tsx scripts/smoke-assessment-validation.ts`

### 34.5 Placement rule

Assessment **configuration** mutations go through `lib/assessment/*-actions.ts`. Grading scales / subject groups stay E07. Results remain future E11.

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
| Attendance | Attendance block (binds E12 later; no facts owned) |
| Co-curricular | Co-curricular block |
| Teacher / principal comments | Dedicated blocks + include flags |
| Signatures | `report_card_template_signatures` (wet_ink / placeholder / digital_stub) |
| Custom layouts | `layout_config` JSON + `custom` block type |
| Assessment refs | `report_card_template_assessments.exam_definition_id` (E11) |
| Versioning | Publish → immutable `report_card_template_versions` snapshot |
| Future PDF | `pdf_generation_enabled` + `report_card_render_jobs` stub |
| Future digital signatures | `digital_signature_enabled` + `requires_digital` flags |

### 35.2 Explicit non-goals

No issued ReportCard rows, PDF bytes, DigiLocker, or duplicated marks/attendance facts.

### 35.3 Hard rule

Templates reference assessments; they do **not** store marks. Future issued cards pin a template **version** and read E11 results at render time (or snapshot then — never mutate live joins for reprints).

### 35.4 Tests

`npx tsx scripts/smoke-report-card-validation.ts`

### 35.5 Placement rule

Template mutations go through `lib/report-cards/*-actions.ts`. Marks remain E11; issued PDFs remain future E20.

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

**Status:** Backend + minimal UI `SHIPPED` (2026-08-07).  
**Owner:** Cross-cutting (read-only aggregator; does not own config rows)  
**Canonical doc:** [`docs/architecture/configuration-dashboard.md`](architecture/configuration-dashboard.md)  
**Module:** `lib/config-dashboard/**`  
**UI:** `/dashboard/configuration`  
**Migration:** none (observes existing engines)

### 39.1 What it shows

| Signal | Source |
|--------|--------|
| Completion status | Per-module heuristics over active row counts + school flags |
| Warnings | Soft gaps (empty holidays, unpublished policies/templates, …) |
| Missing configuration | Hard gaps (no year/terms/classes/subjects when required) |
| Dependency errors | Cross-module breakage (e.g. slots → archived subjects; published RC templates without assessment bindings) |
| Health checks | Informational readiness notes (`backend_only` modules, feature flags) |
| Links | Calendar, houses/clubs, onboarding steps, in-page anchors for API-only modules |

### 39.2 Catalog modules

School branding · Academic calendar · Classes & sections · Subjects · Grading scales · Houses & clubs · Departments · Timetable · Assessment · Report cards · Policies · Communications · Editing framework.

### 39.3 Tests

`npx tsx scripts/smoke-config-dashboard-validation.ts`

### 39.4 Placement rule

Write paths stay in owning engines (`lib/calendar`, `lib/subjects`, …). The dashboard only aggregates and links.

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

*End of master document. Update §15 after verification; §3/§4/§8 on schema; §18–§40 on architecture. Phase 0.5 closed; Phase 1 engines shipped; production gate open (§40).*
