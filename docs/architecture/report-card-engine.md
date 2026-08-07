# Report Card Engine (E20 — Phase 3 academic assembly)

> **Phase:** 3 — Academic Recording Platform (enhances Phase 1 templates §35 + Phase 2 issue §46)  
> **Created:** 2026-08-07 · **Updated:** 2026-08-07  
> **Status:** Backend `SHIPPED`. Admin template designer UI `NOT BUILT`. PDF / digital signatures `FUTURE`.  
> **Module:** `lib/report-cards/**`  
> **Migrations:** `20260807190000` (templates) · `20260807270000` (issue) · `20260807480000` (Phase 3)  
> **Companions:** [`report-card-template-engine.md`](report-card-template-engine.md) · [`grade-calculation-engine.md`](grade-calculation-engine.md) · MASTER §65

---

## 1. Purpose

Admin **designs** report card templates (layout blocks, scopes by grade/class, field assignments).  
Teachers **only fill assigned narrative fields**.  
The engine **never stores duplicated academic OLTP** — it dynamically assembles from owning engines and pins `source_refs` + a reprint `presentation_snapshot`.

| Rule | Meaning |
|------|---------|
| P1 | Grades prefer **published E33** results; E11 `exam_results` is fallback only |
| P2 | Attendance / behaviour / achievements / co-curricular / promotion / curriculum / observations are **read by reference** |
| P3 | Teacher narrative lives in version `field_values` + remarks — not in source engines |
| P4 | Lifecycle: **draft → published → locked** (legacy `issued` ≡ published) |
| P5 | Historical versions on `report_card_issue_versions`; reissue opens a new draft version |
| P6 | Digital signatures / PDF bytes remain FUTURE stubs |

---

## 2. Sources assembled

| Block / concern | Source |
|-----------------|--------|
| Assessment results / final marks / letter / points | **E33** `grade_calculation_results` (published runs) → fallback E11 |
| Grade summary (subject / term / overall) | E33 result kinds |
| Attendance | E12 `attendance_records` aggregate |
| Teacher remarks (per-subject) | E11 remarks on fallback path; card fields from assignments |
| Behaviour | E13 `conduct_incidents` |
| Co-curricular | House / club memberships |
| Achievements | **E35** `student_achievements` (calendar-linked + manual) |
| Promotion status | `student_academic_years.promotion_status` |
| Curriculum completion | Section aggregate from `curriculum_topic_progress` |
| Observation records | **E34** `student_observations` (prefer); E32 observation-kind fallback |
| Layout / scopes / signatures | Template designer tables |

---

## 3. Template designer (admin)

| Concern | Implementation |
|---------|----------------|
| Multiple templates | `report_card_templates` |
| Different templates per grade | `report_card_template_scopes` (class / section) |
| Dynamic blocks | `report_card_template_blocks` (+ Phase 3 types) |
| Teacher-only fill fields | `report_card_template_field_assignments` |
| Draft / published / retired | Template status |
| Signatures | Slots + `digital_stub` / FUTURE crypto |
| Version pin | Immutable `report_card_template_versions` on publish |

**New block types:** `grade_summary` · `achievements` · `behaviour` · `curriculum` · `observations` · `promotion`

---

## 4. Issue lifecycle

```
draft ──publish──► published ──lock──► locked
  │                    │
  └──── revoke ◄───────┴── revoke
```

Reissue: `regenerateReportCardDraftAction({ asNewVersion: true })` supersedes prior published/locked version and opens a new draft.

---

## 5. Tables (Phase 3 additive)

| Table / column | Role |
|----------------|------|
| `report_card_template_field_assignments` | Who fills which narrative field |
| `report_card_issue_versions.grade_calculation_run_ids` | Pinned E33 runs |
| `report_card_issue_versions.field_values` | Teacher-filled narratives |
| `report_card_issues.locked_at/by` + status `locked`/`published` | Lock lifecycle |

---

## 6. API

| Action | Permission |
|--------|------------|
| Template CRUD / blocks / scopes / field assignments | `document.template.edit` |
| `createReportCardDraftAction` / regenerate / publish (`issueReportCardAction`) | `document.report_card.issue` |
| `fillReportCardFieldsAction` | `document.report_card.fill` (teachers) |
| `lockReportCardAction` | `document.report_card.lock` |
| Queries / preview | `document.report_card.read` |

---

## 7. Tests

`npx tsx scripts/smoke-report-card-phase3-validation.ts`  
`npx tsx scripts/smoke-report-card-ops-validation.ts`  
`npx tsx scripts/smoke-report-card-validation.ts`

---

## 8. Non-goals (this ship)

Full drag-and-drop designer UI, PDF bytes, DigiLocker, crypto digital signatures, live auto-regen on every mark keystroke.
