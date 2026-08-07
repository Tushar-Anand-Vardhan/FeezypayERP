# FeezypayERP — Report Card Template Engine (E20 Document config surface)

> **Phase:** 1 — Implementation (+ Phase 3 block/assignment extensions)  
> **Created:** 2026-08-07  
> **Owner engine:** **E20 Document** (templates — issue lives in [`report-card-engine.md`](report-card-engine.md) / MASTER §46 / §65)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`report-card-engine.md`](report-card-engine.md)

---

## 1. Scope

| Supported (config) | Explicitly out of scope |
|--------------------|-------------------------|
| Boards catalog | Issued ReportCard PDFs |
| Templates (draft → published → retired) | Marks / result snapshots |
| Class / section scopes | DigiLocker / QR verify |
| Dynamic layout blocks | Attendance fact ownership (E12) |
| Field assignments (who fills narratives) | Crypto digital signing |
| Signature slots | |
| Custom layout config (page, margins, theme) | |
| Assessment bindings by `exam_definition_id` | |
| Immutable template versions on publish | |
| Future flags: PDF jobs table, digital signature | |

**Hard rules**
- Templates **reference** assessments / E33 runs — never duplicate marks.
- Archive over hard delete; published templates are immutable (clone → draft to edit).
- Issued artifacts pin `report_card_template_versions.id` (+ optional `grade_calculation_run_ids`).
- Digital signatures remain stubs (`digital_stub` / FUTURE crypto).

---

## 2. Schema

`supabase/migrations/20260807190000_report_card_template_engine.sql`  
`supabase/migrations/20260807480000_report_card_engine_phase3.sql` (field assignments + block types)

| Table | Purpose |
|-------|---------|
| `report_card_boards` | Board affiliation catalog |
| `report_card_templates` | Template header + layout flags |
| `report_card_template_versions` | Immutable publish snapshots |
| `report_card_template_scopes` | Class / section applicability |
| `report_card_template_assessments` | E11 assessment refs |
| `report_card_template_blocks` | Dynamic sections |
| `report_card_template_field_assignments` | Teacher fillable narrative fields |
| `report_card_template_signatures` | Signature slots |
| `report_card_render_jobs` | FUTURE PDF generation stub |

**Block types:** `header` · `student_info` · `grades` · `grade_summary` · `remarks` · `attendance` · `co_curricular` · `achievements` · `behaviour` · `curriculum` · `observations` · `promotion` · `teacher_comments` · `principal_comments` · `signatures` · `custom` · `spacer`

---

## 3. Module

```text
lib/report-cards/
  types.ts
  validation.ts
  server-helpers.ts
  boards-actions.ts
  templates-actions.ts
  scopes-actions.ts
  assessments-actions.ts
  blocks-actions.ts
  signatures-actions.ts
  field-assignments-actions.ts
```

---

## 4. Tests

`npx tsx scripts/smoke-report-card-validation.ts`  
`npx tsx scripts/smoke-report-card-phase3-validation.ts`

---

*MASTER §35 · §65.*
