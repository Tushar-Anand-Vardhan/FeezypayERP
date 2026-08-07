# Assessment Operations Engine (E11 marks)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`.  
> **Module:** `lib/assessment/**` (ops files + config)  
> **Migration:** `supabase/migrations/20260807260000_assessment_operations_engine.sql`  
> **Companions:** [`assessment-configuration-engine.md`](assessment-configuration-engine.md) · [`versioning.md`](versioning.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §45

---

## 1. Purpose

Own **append-only assessment results**. Teachers enter marks (single or bulk) with remarks; **Admin/HOD lock** freezes teacher edits. Publish/lock opens parent/student visibility. Corrections after lock **supersede** prior rows — never silent overwrite.

| Rule | Meaning |
|------|---------|
| P1 | No student names/phones on result rows — IDs only |
| P2 | Historical meaning preserved via supersede + compensating row + audit |
| P3 | Mark session owns batch lifecycle: `draft` → `published` → `locked` |
| P4 | Teachers may edit while `draft` or `published` and not locked |
| P5 | Analytics are **derived** queries — not a second SoT |
| P6 | Config (types/categories/definitions) stays Phase 1 config surface |

---

## 2. Tables

| Table | Role |
|-------|------|
| `exam_definitions` (+ origin / operational_kind) | Scheduled (admin) + teacher-created assessments |
| `exam_subject_schedules` (+ optional section_id) | Class/section subject schedule |
| `assessment_mark_sessions` | Bulk marks container; publish/lock gate |
| `exam_results` (enriched) | Per-student marks / grades / remarks |
| `assessment_results_audit_log` | Append-only audit |

**Operational kinds (teacher):** `class_test` · `project` · `practical` · `assignment` · `oral` · `other`

---

## 3. Workflow

**Marks workflow:** `draft` → `published` → `locked`

- **Draft:** teacher entry; not visible to parents/students  
- **Published:** visible; teachers may still edit  
- **Locked:** Admin/HOD freeze; teachers cannot edit — use `correctMarkAction`

---

## 4. API

| Action | Notes |
|--------|-------|
| `createTeacherAssessmentAction` | Class test / project / practical / assignment / oral |
| `listTeacherAssessmentsAction` / `listScheduledAssessmentsAction` | Discovery |
| `archiveTeacherAssessmentAction` | Soft-archive teacher-created only |
| `upsertMarkAction` | Single student mark + remark |
| `bulkUpsertMarksAction` | Section/class roster bulk |
| `publishMarkSessionAction` | Opens guardian/student visibility |
| `lockMarkSessionAction` / `unlockMarkSessionAction` | Freeze / Admin unlock |
| `correctMarkAction` | Supersede + compensating row |
| `listSessionMarksAction` / `listStudentMarksAction` | Queries (`visibleOnly` for portals) |
| `getMarksAnalyticsAction` | Derived averages / counts |
| `listAssessmentResultsAuditAction` | Audit trail |

Config APIs remain in existing `*-actions.ts` files (types, categories, policies, definitions, components, schedules).

---

## 5. Placement

- WF-TCH-05 enter marks; WF-HOD-03 / WF-PRI-08 publish/lock; WF-PAR-05 / WF-STU-04 consume visible results.  
- Student Profile `assessments` module reads `exam_results`.  
- Report cards (E20) reference definitions; never store marks copies.

---

## 6. Tests

`npx tsx scripts/smoke-assessment-ops-validation.ts`
