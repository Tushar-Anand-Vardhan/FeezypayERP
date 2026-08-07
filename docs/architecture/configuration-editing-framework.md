# FeezypayERP — Configuration Editing Framework

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner:** Cross-cutting (uses **E28 Audit** tables; enforces [`versioning.md`](versioning.md))  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md)

---

## 1. Problem

Phase 1 shipped many configuration modules (`lib/config`, calendar, departments, subjects, timetable, assessment, report-cards, policies, communications). Each had partial archive/restore, but **no shared contract** for:

- Dependency checks before dangerous edits  
- Soft-migration recommendations instead of destructive updates  
- History + audit logging  
- Version-aware mutation gating  

---

## 2. Capabilities

| Capability | Implementation |
|------------|----------------|
| Edit | `evaluateConfigEdit` + module update actions |
| Archive / Restore | Strategy **K**; uniqueness checked on restore |
| Duplicate | `duplicateConfigRowAction` / `duplicateSubjectAction` |
| History | `config_change_history` + `listConfigChangeHistoryAction` |
| Audit log | `audit_entries` + `listConfigAuditEntriesAction` |
| Version tracking | Registry `versioned` + `publish_version` history action |
| Validation | Existing module validators + framework evaluation |
| Dependency checks | Registry `dependencies` → counted refs |
| Soft migration | `recommendSoftMigrations` (rename-only, archive+create, clone version, year clone, block) |

**Hard rule:** Never silently rewrite history. If an edit would invalidate operational records, **deny** and return soft-migration steps.

---

## 3. Schema

`supabase/migrations/20260807220000_configuration_editing_framework.sql`

- `audit_entries` — append-only (E28 minimal)  
- `config_change_history` — snapshots + diffs + optional soft-migration payload  

---

## 4. Module

```text
lib/editing/
  types.ts
  registry.ts          # subject, house, club, grading_scale, department, …
  diff.ts
  soft-migration.ts
  evaluate.ts          # dependency + immutability gates
  record.ts            # write audit + history
  actions.ts           # list history/audit, evaluate, duplicate
  index.ts
```

**Reference wiring:** `lib/config/subjects-actions.ts`, `lib/config/grading-scales-actions.ts` call `evaluateConfigEdit` / `recordConfigMutation`. Remaining modules should adopt the same pattern.

---

## 5. Soft migration kinds

| Kind | When |
|------|------|
| `rename_only` | Cosmetic rename while refs exist |
| `archive_and_create` | Semantic change needed; keep old id for history |
| `clone_new_version` | Versioned catalogs (scales, templates, policies) |
| `year_scoped_clone` | Structure across academic years |
| `blocked_use_correction_workflow` | Hard delete / correction-only paths |

---

## 6. Tests

`npx tsx scripts/smoke-editing-validation.ts`

---

*MASTER §38.*
