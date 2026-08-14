# FeezypayERP — Assessment Configuration Engine (E11 config surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E11 Assessment** (config surface — marks live in [`assessment-operations-engine.md`](assessment-operations-engine.md) / MASTER §45)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`assessment-operations-engine.md`](assessment-operations-engine.md)

---

## 1. Scope

| Supported (config) | Explicitly out of scope (this doc) |
|--------------------|-------------------------------------|
| Exam types catalog | Marks entry → **ops engine** (§45) |
| Assessment categories (theory/internal/practical/project/oral/optional) | Moderation workflow UI |
| School/year assessment policies | AI evaluation behavior |
| Exam definitions (+ weightage, pass marks, grading type) | Report card generation |
| Components (internal / practical / project breakdown) | Continuous evaluation scoring |
| Subject schedules (optional subjects, component type, pass marks) | |
| Publishing rules + lifecycle | |
| Lock rules + lock/unlock | |
| Pin E07 grading scale versions | |
| Optional E07 subject group scope | |
| Future flags: `moderation_enabled`, `ai_evaluation_enabled` | |

**Hard rules**
- Archive over hard delete (`DELETE` revoked on definitions/schedules).
- Engines own relationships, not Person rows.
- Grading scales / subject groups remain **E07**; E11 references them by FK.
- Publish/lock apply to **configuration lifecycle**, not result publication.

---

## 2. Schema

`supabase/migrations/20260807180000_assessment_configuration_engine.sql`

| Table / change | Purpose |
|----------------|---------|
| `assessment_exam_types` | Admin exam-type catalog + default weightage/max/pass |
| `assessment_categories` | Category kinds catalog |
| `assessment_policies` | School-wide or year-scoped publish/lock defaults + future flags |
| `exam_definitions` enrich | optional `class_id`, type/category FKs, pass_marks, scale version, subject group, publishing/lock, archive |
| `assessment_components` | Theory/practical/internal/project components on a definition |
| `exam_subject_schedules` enrich | pass_marks, optional subject, component_type, schedule time, archive |

**Publishing status:** `draft` → `scheduled` → `published` → `locked` (or `retracted`).

---

## 3. Module

```text
lib/assessment/
  types.ts
  validation.ts
  server-helpers.ts
  exam-types-actions.ts
  categories-actions.ts
  policies-actions.ts
  exam-definitions-actions.ts
  components-actions.ts
  schedules-actions.ts
```

Onboarding exams step writes **per-class** definitions (`exam_definitions.class_id`), then soft-archives and reinserts (compatible with revoked DELETE). Null `class_id` remains school-wide. Prefer engine APIs for ongoing admin configuration.

`npx tsx scripts/smoke-exams-validation.ts` covers onboarding row uniqueness per class.

---

## 4. Tests

`npx tsx scripts/smoke-assessment-validation.ts`

---

*MASTER §34.*
