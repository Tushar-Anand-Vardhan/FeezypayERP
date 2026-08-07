# FeezypayERP — Authentication Platform (E02 Access)

> **Phase:** 2.5 — Authentication only  
> **Created:** 2026-08-07  
> **Status:** Platform `SHIPPED` (AuthN). **Permissions (E03) are OUT OF SCOPE** — see [`rbac.md`](rbac.md).  
> **Module:** `lib/auth/**` · `lib/supabase/admin.ts`  
> **Migration:** `supabase/migrations/20260807400000_authentication_platform.sql`  
> **Companions:** MASTER §55 · [`deferred-identity-followups.md`](../deferred-identity-followups.md) §6 · [`rbac.md`](rbac.md)

---

## 1. Purpose

Authenticate humans once (`auth.users`), bind them to global `persons`, resolve **school memberships** from hybrid evidence, and support **invite → activate → profile complete** without creating orphan schools (F11).

| Rule | Meaning |
|------|---------|
| A1 | Domains never call providers; Auth uses Supabase Auth + audited service-role invite adapter only |
| A2 | School Admin bootstrap stays on `profiles` (breaks E03↔E05 chicken-egg) |
| A3 | Non-admins: no `profiles` row required; tenant access via `membership_schools(uid)` |
| A4 | One Auth account ↔ one Person; multi-school / multi-persona via memberships + `user_active_context` |
| A5 | **No permission keys** in this platform — E03 evaluates later |

---

## 2. F11 — Signup trigger split

| `raw_user_meta_data.intent` | Behavior |
|----------------------------|----------|
| `create_school` | Insert `schools` + `profiles(role=school_admin)` (SaaS owner) |
| `accept_invite` | **No** school/profile; app binds `persons.auth_user_id` after session |
| Missing / other | Treated as **no** school create (safe default for non-signup inserts) |

`/signup` always passes `intent: 'create_school'`.

---

## 3. Membership evidence (hybrid → E29 index)

**Canonical index:** E29 `school_memberships` (see [`membership-engine.md`](membership-engine.md)).

`membership_schools(uid)` returns distinct school ids from **active/invited** date-effective memberships (falls back to hybrid union during backfill).

`list_auth_memberships(uid)` prefers the membership index for session UI.

---

## 4. Personas (routing only)

| Persona | Evidence |
|---------|----------|
| `school_admin` | `profiles.role` |
| `principal` / `vice_principal` / `teacher` / `hod` / `staff` | `teacher_employments.school_persona` (+ `is_hod` → `hod`) |
| `student` | Active admission |
| `parent` | Parent profile + links at school |
| `alumni` | Admission `status=alumni` |

---

## 5. Invite lifecycle

```text
Admin creates/reuses person + employment (invited) / parent / admission
  → auth_invites (pending)
  → service-role inviteUserByEmail / generateLink (intent=accept_invite)
  → user verifies / sets password
  → acceptInviteSessionAction binds persons.auth_user_id
  → if profile_completed_at IS NULL → /activate/profile
  → completeProfileAction → profile_completed_at; employment invited→active
  → user_active_context set
```

Statuses: `pending | accepted | revoked | expired`. Soft-archive only.

---

## 6. Tables

| Table | Role |
|-------|------|
| `auth_invites` | Invite orchestration |
| `user_active_context` | Active `school_id` + `persona` per auth user |
| `teacher_employments.school_persona` | Staff persona for AuthN routing |
| `auth_admin_audit_log` | Service-role invite/admin calls |

---

## 7. App modules

| Path | Role |
|------|------|
| `lib/supabase/admin.ts` | Service-role client (invite only) |
| `lib/auth/membership.ts` | Resolve memberships / schools |
| `lib/auth/invites-actions.ts` | Create / revoke / resend |
| `lib/auth/activation-actions.ts` | Accept invite session bind |
| `lib/auth/profile-completion-actions.ts` | First-login wizard |
| `lib/auth/session-context.ts` | Active school/persona |
| `lib/auth/routing.ts` | Post-auth + activate gates |

---

## 8. Explicit non-goals

- E03 `has_permission` / role bundles  
- Full portals beyond activate + context switch  
- WhatsApp/SMS invite channels  
- Super-admin platform tenancy  

---

*Companion: MASTER §55.*
