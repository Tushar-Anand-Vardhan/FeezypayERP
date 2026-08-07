# FeezypayERP — House & Club Engine (E07 surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E07 Configuration** (house/club catalog + memberships)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`configuration-engine.md`](configuration-engine.md)

---

## 1. Scope

| Supported | Future (schema stubs) |
|-----------|------------------------|
| Houses / clubs catalog | House points ledger writes |
| Membership (dated) | Club events / competitions |
| Captain / vice captain | Inter-house activities |
| Teacher in charge (employment FK) | Full logo upload UI |
| Colours, logo path, description | |
| Academic year scope (null = school-wide) | |

**Hard rule:** Houses/clubs own **relationships**, not Person rows. TIC → `teacher_employments`. Memberships → `student_profiles` via admissions.

---

## 2. Schema

Migration: `supabase/migrations/20260807150000_house_club_engine.sql`

- Enrich `houses` / `clubs`
- `house_memberships` (+ backfill from `student_admissions.house_id`)
- Enrich `club_memberships` with `role`, `academic_year_id`
- Stub tables: `house_point_ledger`, `club_event_links`

Legacy: membership writes sync `student_admissions.house_id`.

---

## 3. Module

```text
lib/houses-clubs/
  types.ts
  validation.ts
  server-helpers.ts
  houses-actions.ts
  clubs-actions.ts
  house-memberships-actions.ts
  club-memberships-actions.ts
```

Onboarding catalog sync remains in `lib/config/houses-actions` / `clubs-actions`.  
`lib/config/club-memberships-actions` re-exports engine memberships.

UI: `/dashboard/houses-clubs`

---

## 4. Tests

`npx tsx scripts/smoke-houses-clubs-validation.ts`

---

*MASTER §31.*
