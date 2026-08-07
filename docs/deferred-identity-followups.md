# Deferred work after Global Identity Architecture (Steps 0–8)

> Canonical living doc: **[`docs/MASTER.md`](MASTER.md)** — update that file for architecture, auth, schema, tests, and forward plans. This file is a short extract of deferred items only; keep it aligned with MASTER §14.
>
> Engine boundaries (Phase 0.5): **[`docs/architecture/business-engines.md`](architecture/business-engines.md)**.
> Domain model (Phase 0.5): **[`docs/architecture/domain-model.md`](architecture/domain-model.md)**.
> System events (Phase 0.5): **[`docs/architecture/system-events.md`](architecture/system-events.md)**.
> RBAC (Phase 0.5): **[`docs/architecture/rbac.md`](architecture/rbac.md)**.
> Versioning (Phase 0.5): **[`docs/architecture/versioning.md`](architecture/versioning.md)**.
> Audit logging (Phase 0.5): **[`docs/architecture/audit-log.md`](architecture/audit-log.md)**.
> Notification Engine (Phase 0.5): **[`docs/architecture/notification-engine.md`](architecture/notification-engine.md)**.
> AI architecture (Phase 0.5): **[`docs/architecture/ai-architecture.md`](architecture/ai-architecture.md)**.
> Phase 0.5 review (**COMPLETE**): **[`docs/architecture/phase-05-architecture-review.md`](architecture/phase-05-architecture-review.md)**.

Do **not** start these until the identity model is live and onboarding smoke-tested.

## 1. Student bulk input UX
- Year-start CSV vs mid-year single admission flows
- Minimize required fields on first pass; progressive enrichment later
- Field guide for schools (what is personal vs school vs year-varying)

## 2. Academic results (append-only)
- `exam_results` / subject-level results linked to `student_academic_years` + `exam_definitions`
- Never overwrite prior year marks

## 3. Attendance
- Backend shipped (MASTER §44 / E12). UI still open.

## 4. Behaviour & remarks
- Backend shipped (MASTER §48 / E13). UI still open.

## 5. Health records
- Belong on `student_profiles` / related health tables (lifelong), not school admissions

## 6. Teacher invite + first-login profile wizard

**Status:** AuthN platform **SHIPPED** (MASTER §55 / 2026-08-07). Configure `SUPABASE_SERVICE_ROLE_KEY` for live Auth invite emails.

Schema + product path:
- `persons.auth_user_id` (unique when set) — link to Supabase Auth
- `persons.profile_completed_at` — null until first-login wizard finishes
- `person_roles (person_id, role)` — `teacher|student|parent|admin` (multi-role OK)
- `teacher_employments.status` includes `invited`; `school_persona` for AuthN routing
- `auth_invites` + `/invite/accept` + `/activate/profile`
- RLS: `membership_schools(auth.uid())`; self person via `auth_user_id`

**Implemented invite flow**
1. School admin saves staff / calls `createInviteAction`
2. Employment `status=invited` for new emailed staff; `auth_invites` pending
3. Service-role `inviteUserByEmail` (or warn if key missing)
4. Accept session binds `persons.auth_user_id`
5. Profile wizard sets `profile_completed_at` and flips employment to `active`
6. Same pattern available for parents/students via invite actions

See [`docs/architecture/authentication-platform.md`](architecture/authentication-platform.md).

## 7. Teacher marketplace / public profiles
- Public subset of `teacher_profiles` + verification

## 8. Transfers & certificates
- New `student_admissions` / `teacher_employments` rows; never overwrite history
- Transfer certificate generation from admission + academic year timeline
