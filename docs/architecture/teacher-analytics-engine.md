# Teacher Analytics Engine (E22 — teacher slice)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. AI insights `FUTURE` (placeholder only).  
> **Module:** `lib/teacher-analytics/**`  
> **Migration:** `supabase/migrations/20260807330000_teacher_analytics_engine.sql`  
> **Companions:** [`student-analytics-engine.md`](student-analytics-engine.md) · [`teacher-workspace.md`](teacher-workspace.md) · MASTER §52  
> **Workflows:** WF-PRI-01 · WF-PRI-05 · WF-HOD-01 · WF-TCH-11

---

## 1. Purpose

Produce **deterministic teacher analytics** from live OLTP: completion rates, student outcomes in taught classes, workload, and department contribution. **No AI** in v1 — `aiInsights.status = not_built`.

| Rule | Meaning |
|------|---------|
| P1 | Never writes attendance / marks / homework / timetable facts |
| P2 | Snapshots are regenerate-able marts |
| P3 | Thresholds in `TEACHER_ANALYTICS_THRESHOLDS` |
| P4 | Insights carry `code` + `evidence` |
| P5 | E23 may narrate later — must not invent scores here |
| P6 | Scoped by `employment_id` + `academic_year_id` |

---

## 2. Aggregates

| Aggregate | Sources |
|-----------|---------|
| Attendance completion | `attendance_sessions` for taught sections; `taken_by_employment_id` |
| Assessment completion | `assessment_mark_sessions` / `exam_results` by `entered_by_employment_id` |
| Homework completion | `homework_assignments` + `homework_submissions` |
| Average student performance | Published/locked `exam_results` in taught sections/subjects |
| Teacher workload | Weekly periods + open homework + draft mark sessions |
| Classes taught | `timetable_slots` (`teacher_id` = employment) + `employment_subjects` |
| Department contribution | `department_memberships`, teaching assignments, HOD flag |
| Future AI insights | Placeholder only |

---

## 3. API

| Action | Notes |
|--------|-------|
| `generateTeacherAnalyticsAction` | Compute; optional persist |
| `getLatestTeacherAnalyticsSnapshotAction` | Latest mart |
| `listTeacherAnalyticsSnapshotsAction` | History |
| `listTeacherWorkloadRisksAction` | Year risk rollup |
| `buildTeacherAnalyticsReport` / `deriveTeacherInsights` | Pure helpers |

---

## 4. Tables

`teacher_analytics_snapshots` · `teacher_analytics_audit_log`

---

## 5. Tests

`npx tsx scripts/smoke-teacher-analytics-validation.ts`
