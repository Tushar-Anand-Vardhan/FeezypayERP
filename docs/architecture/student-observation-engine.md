# FeezypayERP — Student Observation Engine (E34)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E34 Student Observation**  
> **Companions:** [`behaviour-engine.md`](behaviour-engine.md) · [`assessment-recording-engine.md`](assessment-recording-engine.md) · [`report-card-engine.md`](report-card-engine.md) · MASTER §66  
> **Module:** `lib/observations/` · Migration `20260807490000_student_observation_engine.sql`

---

## 1. Purpose

Teachers record **structured observations** throughout the academic year. Students **accumulate** observations — **nothing is overwritten**. Report cards / profiles / future AI read by reference.

| Rule | Meaning |
|------|---------|
| P1 | Every observation is an immutable insert (`remark` never updated) |
| P2 | Soft-archive or supersede-with-new-row only — no silent overwrite |
| P3 | Year / term / category / subject / teacher / visibility filters |
| P4 | Distinct from E13 discipline incidents and E32 assessment evidence |
| P5 | AI summaries are a **queued stub** (no provider calls in v1) |

---

## 2. Categories

| Code | Name |
|------|------|
| `academic` | Academic |
| `behaviour` | Behaviour |
| `participation` | Participation |
| `leadership` | Leadership |
| `creativity` | Creativity |
| `communication` | Communication |
| `reading` | Reading |
| `writing` | Writing |
| `speaking` | Speaking |
| `discipline` | Discipline |
| `social_skills` | Social Skills |
| `custom` / school codes | Custom Categories |

System seeds are ensured per school on first configure/list. Schools may add custom categories (`is_system=false`).

---

## 3. Observation fields

| Field | Column |
|-------|--------|
| Date | `observed_on` |
| Teacher | `recorded_by` / `recorded_by_employment_id` |
| Subject | `subject_id` (optional) |
| Category | `category_id` + denormalized `category_code` |
| Remark | `remark` (immutable) |
| Visibility | `visibility` → guardian/student flags |
| Term | `term_id` |
| Academic Year | `academic_year_id` |

**Visibility:** `private` · `staff` · `parent_visible` · `school` (same model as E13).

---

## 4. Schema

| Table | Role |
|-------|------|
| `student_observation_categories` | Catalog |
| `student_observations` | Append-only facts |
| `student_observation_ai_summaries` | FUTURE AI job stub |
| `student_observation_audit_log` | Local audit |

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `student_observation.read` | Teacher+; student/parent (visibility-filtered) |
| `student_observation.record` | Teacher+ |
| `student_observation.configure` | Admin / HOD |
| `student_observation.archive` | Admin / HOD |

---

## 6. API

| Action | Notes |
|--------|-------|
| `ensureSystemObservationCategoriesAction` | Seed system codes for school |
| `upsertCustomObservationCategoryAction` | Custom categories |
| `archiveObservationCategoryAction` | Soft-archive category |
| `recordStudentObservationAction` | Append-only create |
| `supersedeStudentObservationAction` | New row + soft-archive prior (no overwrite) |
| `archiveStudentObservationAction` | Soft-archive |
| `setObservationVisibilityAction` | Visibility metadata only (remark untouched) |
| `listStudentObservationsAction` | Filters |
| `getStudentObservationAction` | Single |
| `queueObservationAiSummaryAction` | FUTURE stub (queues row, no LLM) |
| `listObservationAiSummariesAction` | Stub list |
| `listObservationAuditAction` | Audit |

---

## 7. Placement

- E20 report cards prefer E34 rows for the observations block (E32 observation-kind remains fallback).
- E13 owns discipline **incidents**; E34 owns developmental **observations** (may share category themes).
- E23 AI may later consume queued summary jobs — never write over observations.

---

## 8. Tests

`npx tsx scripts/smoke-student-observation-validation.ts`

---

*MASTER §66.*
