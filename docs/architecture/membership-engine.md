# FeezypayERP — Membership Engine (E29)

> **Phase:** 2.7 — Membership  
> **Created:** 2026-08-07  
> **Status:** Platform `SHIPPED` (membership index + preferences + switch).  
> **Module:** `lib/membership/**`  
> **Migration:** `supabase/migrations/20260807420000_membership_engine.sql`  
> **Companions:** MASTER §57 · [`authentication-platform.md`](authentication-platform.md) · [`authorization-platform.md`](authorization-platform.md) · [`business-engines.md`](business-engines.md)

---

## 1. Purpose

Index every **person ↔ school** relationship for AuthN/AuthZ session surfaces. Domain facts stay in E01 / E05 / E06; E29 owns the **membership index**, **history**, and **default/active school preferences** so one Auth account switches schools without a second login.

| Rule | Meaning |
|------|---------|
| M1 | Source facts remain employment / admission / parent link / profiles |
| M2 | `school_memberships` is the session SoT; writers sync into it |
| M3 | E03 evaluates permission keys; membership stores persona + optional `authz_role_ids` |
| M4 | Soft-end / transfer / archive only — never hard-delete history |
| M5 | `membership_schools(uid)` reads the index (date-effective active/invited) |

---

## 2. Membership kinds

| Kind | Source | Capability class |
|------|--------|------------------|
| `school_admin` | `profiles` | `admin` |
| `staff` | `teacher_employments` | `teacher` |
| `student` | `student_admissions` (active) | `student` |
| `alumni` | admission `status=alumni` | `student` |
| `parent` | parent profile + child admission at school | `parent` |
| `former_staff` | employment `status=ended` | `teacher` |

Staff personas (`teacher`, `principal`, `vice_principal`, `hod`, `staff`, `consultant`, `substitute`) live on `school_persona` / employment type.

---

## 3. Tables

| Table | Role |
|-------|------|
| `school_memberships` | Person↔school index (`source_type` + `source_id` unique) |
| `school_membership_history` | Append-only status/date/role changes |
| `user_school_preferences` | Default + active school / membership per person |

Dual-write: switch updates preferences **and** `user_active_context` (AuthN session row) for compatibility.

---

## 4. Module map

| File | Role |
|------|------|
| `types.ts` / `validation.ts` | Kinds, statuses, DTOs |
| `sync.ts` | Upsert from employment / admission / parent / profile |
| `query-actions.ts` | List mine, active context, history |
| `switch-school-actions.ts` | Set active school/membership |
| `preferences-actions.ts` | Set default school |
| `transfer-actions.ts` | End membership A + activate B (student transfer) |
| `server-helpers.ts` | `getActiveMembershipContext()` for AuthN/AuthZ |

---

## 5. Sync points

| Writer | Sync |
|--------|------|
| School signup / admin profile | `syncAdminMembership` |
| Staff employment create/update/end | `syncStaffMembership` |
| Student admission create/status | `syncStudentMembership` |
| Parent link upsert | `syncParentMembership` |
| Employment invited→active | `syncStaffMembership` |

---

## 6. Placement

New person↔school links must call sync. AuthZ `resolveActor` / AuthN switcher consume E29 list helpers (with AuthN RPC still backed by the index).

---

*Companion: MASTER §57.*
