# Teacher Workspace

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend aggregator `SHIPPED` · Minimal UI `SHIPPED` · Teacher Portal F09 `SHIPPED`  
> **Module:** `lib/teacher-workspace/**`  
> **UI:** `/dashboard/teacher` (homepage surface for teachers; admin preview via employment picker)  
> **Migration:** `supabase/migrations/20260807240000_teacher_workspace.sql` (homework SCHEMA-READY only)  
> **Companions:** [`daily-workflows.md`](../operations/daily-workflows.md) · [`user-journeys.md`](user-journeys.md) · MASTER §43

---

## 1. Purpose

The **Teacher Workspace** is the teacher **homepage**: a single aggregated view of what needs attention today.

| Rule | Meaning |
|------|---------|
| P1 | Every panel is filled from **operational / config tables** — never hardcoded demo rows |
| P2 | Empty panels when no data (honest), not fake content |
| P3 | Writes stay in owning engines; workspace is read aggregation (+ homework stubs later) |
| P4 | Resolve actor via `persons.auth_user_id` → employment when teacher login exists; until then Admin may pass `employmentId` |
| P5 | AI shortcuts are **placeholders** naming E23 services only |

---

## 2. Panels

| Panel | Source |
|-------|--------|
| Today’s timetable | `timetable_slots` for employment + today’s `day_of_week` + `period_definitions` |
| Pending attendance | Distinct sections in today’s slots with **no** `attendance_records` for that section+date |
| Pending assessments | Published `exam_definitions` + `exam_subject_schedules` for teacher’s subjects/classes lacking `exam_results` |
| Homework | **SHIPPED** `homework_assignments` (+ submissions §50; empty until teachers create) |
| Announcements | Published `department_announcements` with `visibility in ('staff','school')` |
| Upcoming events | `calendar_events` (approved/published) for active year, future `starts_at` |
| Class reminders | Remaining periods today (from timetable) + near-term events touching taught sections |
| Department notices | Published `department_announcements` with `visibility = 'department'` for teacher’s departments |
| AI shortcuts | Static catalogue of allowed `ai.*` service ids (no school-specific hardcoding) |

---

## 3. API

Pages call `buildTeacherWorkspace` / `listActiveEmployments` / `resolveEmploymentForAuthUser` from `lib/teacher-workspace/` directly (no unused action wrappers).

---

## 4. Placement

- Cite workflows: WF-TCH-01…11, WF-HOD-*.  
- Do not store workspace snapshots.  
- When F11 ships, route teachers’ post-login home to `/dashboard/teacher`.

---

## 5. Tests

`npx tsx scripts/smoke-teacher-workspace-validation.ts`
