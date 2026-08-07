# Homework & Assignment Engine

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. Student self-submit `FUTURE`. AI evaluation schema-only.  
> **Module:** `lib/homework/**`  
> **Migration:** `supabase/migrations/20260807310000_homework_assignment_engine.sql`  
> **Base stub:** `homework_assignments` from Teacher Workspace (`20260807240000`)  
> **Companions:** [`teacher-workspace.md`](teacher-workspace.md) · [`ai-architecture.md`](ai-architecture.md) · MASTER §50  
> **Workflows:** WF-TCH-07 (adjacent) · WF-STU-04 · WF-PAR-05

---

## 1. Purpose

Own **teacher-assigned learning work**: homework, assignments, and projects — with due dates, late policy, attachments, marks, teacher feedback, and parent visibility. Student portal upload and E23 AI evaluation are **schema-ready / stubbed**, not live.

| Rule | Meaning |
|------|---------|
| P1 | Brief lives on `homework_assignments`; per-student outcomes on `homework_submissions` |
| P2 | Soft-archive; never hard-delete submissions with marks |
| P3 | Marks/feedback are teacher-owned facts (not Assessment `exam_results`) |
| P4 | Parent/student visibility flags gate portal lists |
| P5 | AI evaluation never auto-writes authoritative marks |
| P6 | Media bytes stay in E27; only `uuid[]` refs here |

---

## 2. Assignment kinds

| Kind | Use |
|------|-----|
| `homework` | Routine homework |
| `assignment` | Graded assignment |
| `project` | Longer project |

Status: `draft` → `assigned` (published) → `closed`.

---

## 3. Late submissions

- `due_on` / `due_at` define deadline  
- `allow_late` + `late_until` control acceptance window  
- `computeIsLate` sets `is_late` and may set status `late` when recording  

---

## 4. Tables

| Table | Role |
|-------|------|
| `homework_assignments` | Enriched brief (kind, marks, late, attachments, visibility, AI flags) |
| `homework_submissions` | Per-student receipt / marks / feedback / AI stub |
| `homework_audit_log` | Append-only audit |

---

## 5. API

| Action | Notes |
|--------|-------|
| `createHomeworkAction` / `updateHomeworkAction` | Draft or publish |
| `publishHomeworkAction` / `closeHomeworkAction` / `archiveHomeworkAction` | Lifecycle |
| `setHomeworkParentVisibilityAction` | Parent visibility |
| `recordHomeworkSubmissionAction` | Teacher-recorded receipt (+ optional grade) |
| `gradeHomeworkSubmissionAction` | Marks + feedback |
| `submitHomeworkAsStudentAction` | **FUTURE** — returns not available |
| `requestHomeworkAiEvaluationAction` | Sets `ai_evaluation_status=pending` only |
| `listHomeworkAction` / `getHomeworkAction` | Teacher/admin |
| `listStudentHomeworkAction` | Parent/student filtered lists |
| `listHomeworkSubmissionsAction` / `listHomeworkAuditAction` | Query |

---

## 6. Placement

- Teacher Workspace homework panel reads the same `homework_assignments` table  
- Formal exams / published marks stay **E11**  
- Lesson plans (WF-TCH-07) remain E10 future — this engine owns assigned work products  

---

## 7. Non-goals (this ship)

- Homework compose UI  
- Student/parent portal upload UX  
- Real E23 AI scoring  
- Copying homework marks into `exam_results`

---

## 8. Tests

`npx tsx scripts/smoke-homework-validation.ts`
