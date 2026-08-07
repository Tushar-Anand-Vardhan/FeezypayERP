# Student Profile Engine

> **Phase:** 2 — Operations (first implementation)  
> **Created:** 2026-08-07  
> **Status:** Backend aggregator `SHIPPED`. Student Portal UI `SHIPPED` (§60).  
> **Module:** `lib/student-profile/**`  
> **Migration:** `supabase/migrations/20260807230000_student_profile_engine.sql` (SCHEMA-READY stubs only)  
> **Companions:** [`domain-model.md`](domain-model.md) · [`business-engines.md`](business-engines.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §42

---

## 1. Purpose

The **Student Profile** is the product **single source of truth surface** for everything about a student: one API that assembles the full picture.

It **aggregates**. It **does not copy** operational facts into a parallel student blob.

| Rule | Meaning |
|------|---------|
| P1 | Each fact stays owned by its engine (E04 Identity, E06 Enrollment, E11 Assessment, …) |
| P2 | Profile modules **read** via FK / joins; they never invent denormalized name/marks/attendance copies |
| P3 | Writes go through the owning engine’s tables (profile helpers may be thin façades) |
| P4 | Missing engines return `schema_ready` / empty modules — never fake data |
| P5 | Future AI summary proposes narrative from aggregated modules; never writes OLTP |

---

## 2. Module catalogue

| Module ID | Surface | Owner engine(s) | Source today |
|-----------|---------|-----------------|--------------|
| `personal` | Name, DOB, gender, contact, photo, global IDs | E04 (+ E14 medical cols on profile) | **Live** `persons` + `student_profiles` |
| `admission` | School relationship, number, status, dates | E06 | **Live** `student_admissions` |
| `academic_history` | Year placements, class/section, promotion | E06 + E09 + E08 | **Live** `student_academic_years` |
| `attendance` | Presence facts | E12 | **Live** `attendance_records` (E12 backend; UI not built) |
| `assessments` | Schedules (config) + results | E11 | Schedules **live**; results **live** (ops §45; UI not built) |
| `report_cards` | Applicable templates + issued artifacts | E20 | Templates **live**; issued **live** (ops §46; PDF later) |
| `events` | Calendar occasions + participation | E17 | **Live** — year events + `event_participants` (§47) |
| `competitions` | Competition entries | E17 | **Live** — linked to `calendar_events` + participants |
| `achievements` | Awards / achievements | E13/E20 satellite | **SCHEMA-READY** `student_achievements` |
| `behaviour` | Conduct / behaviour remarks | E13 | **Live** — timestamped `conduct_incidents` (§48) |
| `medical` | Lifelong attrs + incidents | E14 | Attrs **live** on `student_profiles`; incidents **SCHEMA-READY** `medical_incidents` |
| `documents` | Issued docs / media links | E20 / E27 | **SCHEMA-READY** `student_issued_documents` (+ photo on person) |
| `parents` | Guardians | E04 + E06 | **Live** `student_parent_links` → parents → persons |
| `transport` | Route / stop assignment | Transport satellite | **SCHEMA-READY** `student_transport_assignments` |
| `house` | House membership (+ admission pointer) | E07 (+ E06 pointer) | **Live** `house_memberships` |
| `club_membership` | Club memberships | E07 | **Live** `club_memberships` |
| `ai_summary` | Future narrative slot | E23 | **Placeholder** — no invented facts |

---

## 3. Backend API

| Action | Role |
|--------|------|
| `listStudentProfileDirectoryAction` | School directory summaries (admission + person + current placement) |
| `getStudentProfileAction` | Full aggregate for one `studentProfileId` (school-scoped) |
| `getStudentProfileModuleAction` | Single module lazy load |
| `updateStudentPersonalInformationAction` | Façade write → `persons` / `student_profiles` (no duplicate store) |

---

## 4. SCHEMA-READY stubs

Migration `20260807230000` created empty operational stubs; **E12** (`20260807250000`) enriched `attendance_records` and added sessions/leave/audit. Profile code **reads** engine tables; it does not mirror them elsewhere. Remaining stubs stay empty until their engines ship.

---

## 5. Placement rule

- New student facts → owning engine table first, then show up automatically in the matching profile module.  
- Do **not** add `student_profiles.attendance_json` (or similar) dumps.  
- UI (future) must call `getStudentProfileAction` / module loaders — not ad-hoc cross-engine joins in components.  
- Cite workflow IDs (e.g. WF-ADM-01, WF-TCH-01, WF-PAR-01) when wiring ops into profile modules.

---

## 6. Tests

`npx tsx scripts/smoke-student-profile-validation.ts`
