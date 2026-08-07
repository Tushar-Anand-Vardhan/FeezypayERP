# FeezypayERP — Authorization Platform (E03)

> **Phase:** 2.6 — Authorization  
> **Created:** 2026-08-07  
> **Status:** Platform `SHIPPED` (permission catalog, bundles, `requirePermission`, custom roles). Matrix design remains [`rbac.md`](rbac.md).  
> **Module:** `lib/authz/**`  
> **Migration:** `supabase/migrations/20260807410000_authorization_platform.sql`  
> **Companions:** MASTER §56 · [`authentication-platform.md`](authentication-platform.md) · [`rbac.md`](rbac.md)

---

## 1. Purpose

Every server action asserts a **permission key** before sensitive reads/writes. Pages use `<Can>` / bootstrap keys — never `if (role === …)`.

| Rule | Meaning |
|------|---------|
| Z1 | RLS = tenant membership (`membership_schools`); app = verb + ABAC |
| Z2 | Roles are **bundles of keys**; evaluation is flat key union |
| Z3 | School Admin bootstrap via `profiles` (full school bundle) — no employment required |
| Z4 | Custom school roles ⊆ grantable keys; cannot grant `school_admin` / platform |
| Z5 | Engines declare keys; E03 evaluates only |

---

## 2. Action pattern

```ts
const ctx = await requirePermission("attendance.record.create", {
  sectionId,
  subjectId,
  departmentId,
});
// ctx.supabase, ctx.schoolId, ctx.actor
```

Do **not** hardcode persona strings for allow/deny.

---

## 3. Tables

| Table | Role |
|-------|------|
| `authz_permissions` | Global permission catalog |
| `authz_roles` | System + school custom roles |
| `authz_role_permissions` | Role → keys |
| `authz_member_role_grants` | person + school → role |
| `authz_audit_log` | Grant/revoke / denials |

SQL: `has_permission(uid, school_id, key)` mirrors app evaluator for optional RLS/coarse checks.

---

## 4. Module map

| File | Role |
|------|------|
| `catalog.ts` / `bundles.ts` | Keys + system role bundles |
| `resolve-actor.ts` | uid → person, persona, effective keys |
| `evaluate.ts` / `ownership.ts` / `approval.ts` | Allow/deny + ABAC |
| `require.ts` | `requirePermission` / `requireAny` / `requireApprovalPermission` |
| `can.tsx` | `<Can>` client helper |
| `actions.ts` | Custom role grant/revoke |
| `bootstrap.ts` | UI permission list payload |

---

## 5. Hierarchy (grant display)

```text
school_admin → principal → vice_principal → hod → teacher
student / parent / staff — parallel
```

Evaluation does **not** auto-inherit unless keys are seeded into the bundle.

---

## 6. Placement

New actions **must** call `requirePermission`. Prefer specific keys over `tenant.school.read`.
