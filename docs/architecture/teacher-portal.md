# FeezypayERP — Teacher Portal

> **Phase:** 2.9 — Teacher Portal  
> **Created:** 2026-08-07  
> **Updated:** 2026-08-12 — Wave 1 (Students, marks CSV, marking window, coordinator Events, home classroom)  
> **Status:** Portal UI `SHIPPED` (permission-gated routes over Phase 2 engines).  
> **Routes:** `/dashboard/teacher/**`  
> **Module:** `components/teacher-portal/` · `lib/teacher-portal/`  
> **Companions:** MASTER §59 · §68 · [`teacher-workspace.md`](teacher-workspace.md) · [`rbac.md`](rbac.md) · WF-TCH-* in [`daily-workflows.md`](../operations/daily-workflows.md)

---

## 1. Purpose

Expose teacher daily ops as thin clients over existing engines. **No** duplicated attendance/marks/homework stores.

| Rule | Meaning |
|------|---------|
| T1 | Entry requires `workforce.workspace.read` |
| T2 | Feature pages use permission keys + `<Can>` — never `role === 'teacher'` |
| T3 | Writes call owning engine actions only |
| T4 | Homepage remains Teacher Workspace aggregator |

---

## 2. Routes

| Route | Permission (entry) | Engine |
|-------|-------------------|--------|
| `/dashboard/teacher` | `workforce.workspace.read` | teacher-workspace |
| `/dashboard/teacher/attendance` | `attendance.record.create` | attendance |
| `/dashboard/teacher/students` | `enrollment.admission.read` | roster + sheet |
| `/dashboard/teacher/students/[studentProfileId]` | `enrollment.admission.read` | assessment / behaviour / events |
| `/dashboard/teacher/marks` | `assessment.results.enter` | assessment (+ CSV) |
| `/dashboard/teacher/homework` | `homework.read` / assign | homework |
| `/dashboard/teacher/behaviour` | `conduct.incident.record` | behaviour |
| `/dashboard/teacher/events` | `engagement.event.read` (+ create to write) | events/calendar |
| `/dashboard/teacher/announcements` | `communication.message.read` | communications / departments |
| `/dashboard/teacher/resources` | `workforce.department.read` | departments |
| `/dashboard/teacher/department` | `workforce.department.read` | departments |
| `/dashboard/teacher/profile` | `identity.person.read` | identity / employment |

Query: `?employment=` for admin preview when multiple employments exist.

**Section scope:** prefer `sections.class_teacher_id` (Home classroom), then `timetable_slots`, then school-wide fallback.

**Marking window:** `exam_subject_schedules.marking_opens_at` / `marking_closes_at` (null = open until mark session lock).

**Events write:** UI requires `event_staff_assignments` for the actor’s employment plus `engagement.event.create`.

---

## 3. Placement

New teacher UI lives under `components/teacher-portal/` and calls `lib/{attendance,assessment,events,behaviour,…}` actions. Do not add parallel OLTP writers.

---

*Companion: MASTER §59 · §68.*
