# FeezypayERP — Curriculum Engine (E30)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E30 Curriculum**  
> **Companions:** [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`versioning.md`](versioning.md) · [`rbac.md`](rbac.md) · [`MASTER.md`](../MASTER.md)  
> **Module:** `lib/curriculum/` · Migration `20260807440000_curriculum_engine.sql`

---

## 1. Scope

Year / board / grade / subject **curriculum packs** with hierarchical teaching structure, HOD+ CRUD / clone / publish versioning, teacher progress + private notes.

| In scope | Out of scope (this slice) |
|----------|---------------------------|
| Pack CRUD, archive, retire | AI curriculum generation |
| Units → chapters → topics → subtopics | LessonPlan entity / WF-TCH-07 UI |
| Learning outcomes + competencies | Binding exam definitions to topics (FK hook only) |
| Shared resources | Full HOD/Teacher curriculum portal screens |
| Teacher progress + private notes | Auto-migrate `subjects.chapter_map` JSON |
| Publish → immutable `curriculum_versions` snapshot | |

**Grade** = year-scoped `classes` row (`class_id`), not a new grades table.  
**Board** = optional `report_card_boards` FK + `board_code` text (aligned with `subjects.board_code` / `schools.board`).  
**Assign to subject** = create pack for `(academic_year_id, class_id, subject_id)`. `class_subjects` (E07) remains the offer map; curriculum does not replace it.

Downstream (assessment, lesson progress, reports, AI) **must reference `curriculum_version_id`** — do not duplicate chapter trees.

---

## 2. Hierarchy

```text
AcademicYear → Board? → Class (grade) → Subject → Curriculum pack
  → Units → Chapters → Topics → Subtopics
  → Learning outcomes (optional node attach)
  → Competencies (+ M:N to outcomes)
  → Resources / Notes
Publish → curriculum_versions.snapshot (immutable)
Progress pins curriculum_version_id (ops strategy A)
```

---

## 3. Schema

| Table | Role |
|-------|------|
| `curricula` | Root pack; unique active `(school, year, subject, class)` |
| `curriculum_versions` | Immutable published snapshots (strategy **V**) |
| `curriculum_units` / `_chapters` / `_topics` / `_subtopics` | Live draft/edit tree |
| `curriculum_learning_outcomes` | LOs with optional node FKs |
| `curriculum_competencies` | Competency catalog per pack |
| `curriculum_outcome_competencies` | M:N |
| `curriculum_resources` | Shared/staff resources |
| `curriculum_notes` | Teacher notes (`private` \| `shared`) |
| `curriculum_topic_progress` | Ops progress; pins version |
| `curriculum_audit_log` | Local high-churn audit |

**Statuses:** pack `draft` \| `published` \| `retired`. Progress `not_started` \| `in_progress` \| `completed` \| `skipped`.

**RLS:** `membership_schools(auth.uid())`; revoke DELETE; grant select/insert/update to `authenticated`.

---

## 4. Versioning

| Artifact | Strategy | Notes |
|----------|----------|-------|
| Pack structure publish | **V** | Snapshot JSON; `is_current`; forward-only bumps |
| Live structure after publish | **M** (HOD `structure.edit`) | Next publish bumps version; old progress stays pinned |
| Topic progress | **A** | Upsert by teacher/section/version/node; no silent rewrite of other teachers |

Clone deep-copies structure + outcomes/competencies/resources into a new **draft** pack for a target year (optional new class), with clone metadata.

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `curriculum.pack.read` | Teacher+ |
| `curriculum.pack.edit` / `publish` / `archive` / `clone` | HOD+ |
| `curriculum.structure.edit` | HOD+ |
| `curriculum.outcome.edit` / `resource.edit` | HOD+ |
| `curriculum.progress.read` / `record` | Teacher+ |

Server actions use `requirePermission` with attrs `{ subjectId, departmentId }` when available — no `role ===` checks.

---

## 6. Module

```text
lib/curriculum/
  types.ts
  validation.ts
  server-helpers.ts
  codes.ts
  audit.ts
  curricula-actions.ts
  structure-actions.ts
  outcomes-actions.ts
  resources-actions.ts
  notes-actions.ts
  progress-actions.ts
  query-actions.ts
  index.ts
```

Editing registry: `curriculum`, `curriculum_version`.

Optional domain events (DESIGNED): `curriculum.published`, `curriculum.cloned`, `curriculum.topic.completed`.

---

## 7. Tests

`npx tsx scripts/smoke-curriculum-validation.ts` · `npx tsc --noEmit`

---

*MASTER §61.*
