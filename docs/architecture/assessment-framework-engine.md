# FeezypayERP — Assessment Framework Engine (E31)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E31 Assessment Framework**  
> **Companions:** [`business-engines.md`](business-engines.md) · [`assessment-configuration-engine.md`](assessment-configuration-engine.md) · [`assessment-operations-engine.md`](assessment-operations-engine.md) · [`curriculum-engine.md`](curriculum-engine.md) · [`versioning.md`](versioning.md) · [`MASTER.md`](../MASTER.md)  
> **Module:** `lib/assessment-framework/` · Migration `20260807450000_assessment_framework_engine.sql`

---

## 1. Scope

Defines **how every class/subject is evaluated** during an academic year. Created once by School Admin (or authorized academic leadership) **before the year begins**.

| In scope | Out of scope (this slice) |
|----------|---------------------------|
| Framework CRUD per year × class × subject | Teachers designing assessments |
| Configurable assessment categories | Marks / evidence entry (E11 ops) |
| Weightage, max/pass marks, grade mapping | Continuous scoring UI |
| Term binding, visibility, report-card mapping | Full admin portal screens |
| Multiple named formulas (weighted blends) | Auto-compute finals from live marks |
| Publish → immutable versions; clone prior years | Replacing E11 exam_definitions |

**Hard rules**
- Teachers **do not** design the framework — they enter evidence against published framework categories (via E11 ops; pin `assessment_framework_version_id` later).
- E11 `assessment_categories` / `exam_definitions` remain catalogs and scheduled exams; frameworks **reference** optional catalog ids and are the year plan SoT.
- E07 grading scales may be pinned via `grading_scale_version_id` on categories; inline `grade_mapping` jsonb allowed for school-specific bands.

---

## 2. Hierarchy

```text
AcademicYear → Class → Subject → Assessment Framework
  → Categories (Term Exam, Periodic, Practical, …)
  → Formulas (e.g. Term 1 = 50% Classwork + 30% Periodic + 20% Practical)
Publish → assessment_framework_versions.snapshot (immutable)
```

---

## 3. Schema

| Table | Role |
|-------|------|
| `assessment_frameworks` | Root; unique active `(school, year, class, subject)` |
| `assessment_framework_versions` | Immutable publish snapshots (strategy **V**) |
| `assessment_framework_categories` | Configured evaluation slots |
| `assessment_framework_formulas` | Named blend formulas |
| `assessment_framework_formula_parts` | Category × weight_pct within a formula |
| `assessment_framework_audit_log` | Local high-churn audit |

**Category fields:** `category_kind`, optional `assessment_category_id` (E11 catalog), `weightage_percent`, `max_marks`, `pass_marks`, `grade_mapping` jsonb, `grading_scale_version_id`, `included_in_final_grade`, `term_id`, `visibility`, `report_card_mapping` jsonb, `display_order`.

**Category kinds (v1):** `term_exam` · `half_yearly` · `final` · `periodic_test` · `notebook` · `classwork` · `practical` · `project` · `viva` · `observation` · `internal_assessment` · `activity` · `custom`

**Visibility:** `internal` · `teachers` · `students` · `parents` · `all`

**Statuses:** framework `draft` \| `published` \| `retired`.

---

## 4. Versioning

| Artifact | Strategy | Notes |
|----------|----------|-------|
| Framework publish | **V** | Full snapshot of categories + formulas + parts |
| Live edit after publish | **M** (admin `framework.edit`) | Next publish bumps version |
| Clone | Deep-copy into new **draft** for target year/class/subject |

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `assessment_framework.read` | Teacher+ (read published plan) |
| `assessment_framework.edit` | Admin / HOD / VP / Principal |
| `assessment_framework.publish` | Admin leadership |
| `assessment_framework.archive` | Admin leadership |
| `assessment_framework.clone` | Admin leadership |

No `role ===` checks — `requirePermission` only.

---

## 6. Module

```text
lib/assessment-framework/
  types.ts
  validation.ts
  codes.ts
  snapshot.ts
  server-helpers.ts
  audit.ts
  frameworks-actions.ts
  categories-actions.ts
  formulas-actions.ts
  query-actions.ts
  index.ts
```

Editing registry: `assessment_framework`, `assessment_framework_version`.

Optional events (DESIGNED): `assessment_framework.published`, `assessment_framework.cloned`.

---

## 7. Placement vs E11 / E20 / E30

| Concern | Owner |
|---------|-------|
| Year evaluation plan + formulas | **E31** |
| Exam type/category catalogs, scheduled exam defs | E11 config |
| Marks / mark sessions | E11 ops |
| Report card templates / issues | E20 (consume framework version + mappings) |
| Curriculum chapter trees | E30 |

Downstream marks and report cards **should pin `assessment_framework_version_id`** — do not re-encode category weightages on result rows.

---

## 8. Tests

`npx tsx scripts/smoke-assessment-framework-validation.ts` · `npx tsc --noEmit`

---

*MASTER §62.*
