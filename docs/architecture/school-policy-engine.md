# FeezypayERP — School Policy Engine (E07 Configuration policy surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E07 Configuration** (policy definitions)  
> **Consumers:** E08 (timings context), E09/E06 (promotion), E11 (exam eligibility / grace), E12 (attendance / late / half-day / leave), E13 (behaviour), E15/transport (future)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`versioning.md`](versioning.md)

---

## 1. Scope

| Policy kind | Status |
|-------------|--------|
| Attendance rules | Config shipped |
| Promotion rules | Config shipped |
| Working hours | Config shipped |
| School timings | Config shipped |
| Leave types | Config shipped |
| Late arrival | Config shipped |
| Half day | Config shipped |
| Exam eligibility | Config shipped |
| Grace marks | Config shipped |
| Behaviour rules | Config shipped |
| Fee rules | FUTURE stub kind |
| Transport rules | FUTURE stub kind |

**Hard rules**
- Every policy is **versioned** (`school_policy_versions`). Publish → immutable + `is_current`.
- Policies store **rules JSON**, never attendance/marks/placement facts.
- Year-scoped policies override school-wide defaults of the same kind when published.
- Working **days** (instructional weekdays) remain E08 `school_working_day_patterns`; this engine owns **hours/timings** and behavioural thresholds.

---

## 2. Schema

`supabase/migrations/20260807200000_school_policy_engine.sql`

| Table | Purpose |
|-------|---------|
| `school_policies` | Policy document per kind × school × optional year |
| `school_policy_versions` | Versioned `rules` JSON; current published pointer |

Lifecycle: `draft` → `published` → `retired` (archive preferred over delete).

---

## 3. Module

```text
lib/policies/
  types.ts
  defaults.ts
  validation.ts
  server-helpers.ts
  policies-actions.ts
```

Key actions: list/upsert policy, save draft rules (opens N+1 if latest immutable), publish version, get current by kind, retire/archive, ensure defaults.

---

## 4. Tests

`npx tsx scripts/smoke-policy-validation.ts`

---

*MASTER §36.*
