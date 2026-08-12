# FeezypayERP — Configuration Engine (E07) Implementation

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-06  
> **Owner engine:** **E07 Configuration**  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`versioning.md`](versioning.md) · [`domain-model.md`](domain-model.md)

---

## 1. Audit summary (pre-implementation)

### Exists (schema)

| Table / columns | Notes |
|-----------------|-------|
| `subjects`, `class_subjects` | No archive; optional `code`; delete-all onboarding |
| `houses`, `clubs` | No archive; wipe-rewrite onboarding |
| `schools` branding + `houses_enabled` / `clubs_enabled` | Mixed writes with E08 month / E25 flags |
| RLS via `profiles.school_id` | Present |

### Not E07 (do not move here)

`departments` (E05), `academic_year_start_month` (E08), classes/sections (E09), fee heads (E15), exam `grading_type` (E11), onboarding flags (E25).

### Gaps closed in this slice

1. Archive / restore (`archived_at`) on subjects, houses, clubs, grading scales  
2. Stable subject `code` uniqueness (active rows)  
3. `grading_scales` + `grading_scale_versions` (versioned definitions)  
4. `club_memberships` (dated membership; catalog stays E07)  
5. FK `ON DELETE RESTRICT` for subject refs that are operational  
6. `lib/config/` module — create / edit / archive / restore; **no hard delete**  
7. Onboarding rewired to call config upsert (preserve ids)

### Deferred

- HouseMembership as first-class (still `admission.house_id` E06)  
- Splitting school identity save into separate E08 action (branding API exists; onboarding may still write month in same form until Calendar engine)  
- Emitting `config.catalog.updated` event bus (catalogue exists; outbox P0)  
- UI admin screens  

---

## 2. Mutation rules (enforced)

| Action | Behavior |
|--------|----------|
| **Create** | Insert active row (`archived_at` null) |
| **Edit** | Update mutable fields (name, description, type, bands on *draft* scale version) |
| **Archive** | Set `archived_at = now()`; hide from pickers |
| **Restore** | Clear `archived_at` if name/code unique among active |
| **Hard delete** | **Denied** in app; DB DELETE revoked on catalog tables for `authenticated` |

Class–subject links: replace-per-class allowed (operational offer map for open year). Subject ids never wiped.

Grading scales: new **version** for band changes after publish; old versions immutable.

---

## 3. Module layout

```text
lib/config/
  types.ts
  codes.ts                 # slug/code helpers
  subjects.ts              # validate + pure helpers
  subjects-actions.ts
  class-subjects.ts
  class-subjects-actions.ts
  houses.ts / houses-actions.ts
  clubs.ts / clubs-actions.ts
  grading-scales.ts / grading-scales-actions.ts
  school-branding.ts / school-branding-actions.ts
```

Membership writes live under `lib/houses-clubs/*-memberships-actions.ts`.

---

## 4. Test plan

- `scripts/smoke-config-validation.ts` — validation + code helpers (no DB)  
- Migration applied via `supabase db push`  
- Manual: archive subject referenced by employment must not cascade-delete  

---

*Implementation notes live in MASTER §28.*
