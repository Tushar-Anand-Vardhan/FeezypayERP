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
- Daily attendance tables; summaries derived, not duplicated

## 4. Behaviour & remarks
- Dated incident/remark records linked to student profile + academic year

## 5. Health records
- Belong on `student_profiles` / related health tables (lifelong), not school admissions

## 6. Teacher invite + first-login profile wizard

Schema already ready (Step 7):
- `persons.auth_user_id` (unique when set) — link to Supabase Auth
- `persons.profile_completed_at` — null until first-login wizard finishes
- `person_roles (person_id, role)` — `teacher|student|parent|admin` (multi-role OK)
- `teacher_employments.status` includes `invited`
- RLS: self can `SELECT`/`UPDATE` own person via `persons.auth_user_id = auth.uid()`

**Planned invite flow (not built yet)**
1. School admin invites teacher (email) during or after staff onboarding
2. Create/reuse `persons` + `teacher_profiles`; create `teacher_employments` with `status=invited`
3. Send auth invite / magic link / password setup for that email
4. On first successful auth: set `persons.auth_user_id = auth.uid()` (1:1)
5. App gate: if `profile_completed_at is null`, force profile wizard (phone, photo, career fields on `teacher_profiles`)
6. Wizard save sets `profile_completed_at = now()` and flips employment `invited` → `active`
7. Same pattern later for parents/students; a person may hold multiple `person_roles` (e.g. teacher+parent)

## 7. Teacher marketplace / public profiles
- Public subset of `teacher_profiles` + verification

## 8. Transfers & certificates
- New `student_admissions` / `teacher_employments` rows; never overwrite history
- Transfer certificate generation from admission + academic year timeline
