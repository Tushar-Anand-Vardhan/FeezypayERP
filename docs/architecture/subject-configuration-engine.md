# FeezypayERP — Subject Configuration Engine (E07 surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E07 Configuration**  
> **Companions:** [`configuration-engine.md`](configuration-engine.md) · [`MASTER.md`](../MASTER.md)

---

## 1. Scope

Subjects are **more than a name**. The subject master captures scheduling, assessment, board mapping, grouping, and future curriculum hooks.

| Supported | Future (stubs) |
|-----------|----------------|
| Subject master (rich fields) | Full textbook catalog UI |
| Subject groups | AI lesson plan generation |
| Languages / electives (category + flags) | Chapter authoring UI |
| Board mapping (`board_code`, `board_subject_name`) | |
| Credits, weekly periods, lab flag | |
| Assessment rules (JSON) | |
| Display order | |
| Dependencies (prerequisite/corequisite/recommended) | |
| Archive / restore (FK RESTRICT — history preserved) | |

Onboarding still uses `lib/config/subjects-actions` sync (name/code/type only). Rich edits use `lib/subjects/*`.

---

## 2. Schema

`supabase/migrations/20260807160000_subject_configuration_engine.sql`

| Table / column | Purpose |
|----------------|---------|
| `subject_groups` | Named groups (Sciences, Languages…) |
| `subjects.*` enrich | category, group, language, elective, board, credits, periods, lab, assessment_rules, display_order, textbook/AI/chapter stubs |
| `subject_dependencies` | Directed dependency graph |
| `subjects.textbook_*` | ISBN / title columns on subject (multi-book catalog deferred) |

---

## 3. Module

```text
lib/subjects/
  types.ts
  codes.ts
  validation.ts
  server-helpers.ts
  groups-actions.ts
  subjects-actions.ts
  dependencies-actions.ts
```

---

## 4. Tests

`npx tsx scripts/smoke-subject-validation.ts`

---

*MASTER §32.*
