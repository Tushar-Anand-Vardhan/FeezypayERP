# FeezypayERP — RBAC Architecture

> **Phase:** 0.5 — Architecture (design-only for **permissions**)  
> **Created:** 2026-08-06  
> **Status:** Canonical authorization **matrix** + **runtime SHIPPED** (MASTER §56 / [`authorization-platform.md`](authorization-platform.md)). AuthN / membership helpers SHIPPED (§55). Use `requirePermission` in server actions; pages use `<Can>` — never hardcode persona strings for AuthZ.  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`system-events.md`](system-events.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md) · [`authentication-platform.md`](authentication-platform.md) · [`authorization-platform.md`](authorization-platform.md)
> **Owner engine:** **E03 Authorization** evaluates policy; membership **index** owned by **E29**; source facts E01 / E04 / E05 / E06 (+ §55 / §57 SQL helpers).

---

## 1. Goals

1. One authorization answer for every Business Engine: *who may read / create / edit / delete / approve / lock / publish / archive?*  
2. Support today’s personas **and** future custom roles without rewriting engines.  
3. Split **Row Level Security** (hard tenant + coarse membership) from **application AuthZ** (workflows, scopes, approvals).  
4. Align with ownership: E03 never writes `person_roles` or `profiles`; it only evaluates.

---

## 2. Concepts

### 2.1 Layers

```text
auth.users                          ← E02 Access (AuthN)
    │
    ├─► profiles (school_admin)     ← E01 Tenancy (admin membership evidence)
    │
    └─► persons.auth_user_id        ← E04 Identity
            ├─ person_roles[]       ← E04 writes; E03 reads (capability class)
            ├─ teacher_employments  ← E05 (school job + designation + HOD)
            ├─ student_admissions   ← E06
            └─ student_parent_links ← E06

E03 Authorization:
  (auth.uid, school_id, resource, action, attributes)
    → ALLOW | DENY (+ reason)
```

### 2.2 Capability class vs school persona

| Layer | Source | Examples | Purpose |
|-------|--------|----------|---------|
| **Capability class** | `person_roles.role` | `admin`, `teacher`, `student`, `parent` | Broad portal class; multi-role humans OK |
| **School membership** | `profiles` / employment / admission / parent link | Active link to `school_id` | Tenant boundary |
| **School persona (RBAC role)** | Designation + flags + grants | School Admin, Principal, HOD, Teacher… | Permission matrix rows |
| **Attributes (ABAC)** | Employment subjects, class teacher of section, linked child | “marks for *my* sections” | Narrows ● → ◐ |

**Rule:** Persona alone never bypasses membership. No active school link → deny (except Super Admin platform paths and self `persons` row).

### 2.3 Standard actions

| Action | Meaning | Typical use |
|--------|---------|-------------|
| **Read** | View / list / export within policy | Dashboards, portals |
| **Create** | Insert new aggregate | Admit student, create exam |
| **Edit** | Update mutable fields while unlocked | Correct name, adjust slot |
| **Delete** | Hard or soft-remove (prefer soft) | Remove draft club |
| **Approve** | Accept workflow / promotion / suggestion | Promotion request, fee waiver |
| **Lock** | Freeze edits (year close, published grid) | Academic year, published results |
| **Publish** | Make visible to wider audience | Exam published, announcement live |
| **Archive** | Retire from active lists; retain history | Past year, ended employment |

Commands (from event catalogue) are **writes** checked as Create/Edit/Approve/etc. on the owning engine.

### 2.4 Scope codes (used in matrices)

| Code | Meaning |
|------|---------|
| **●** | Full school (tenant) scope |
| **◐** | Scoped: own dept / own classes-sections / own subjects / linked children / self |
| **◇** | Platform / cross-tenant (Super Admin only) |
| **—** | Not permitted |
| **sys** | System / service role only (not a human persona) |

Where two scopes apply, the **narrower** wins unless both are required (e.g. HOD must be ● for dept config and ◐ for other depts → deny other depts).

---

## 3. Personas

### 3.1 Current product personas

| Persona ID | Display | How assigned (target) | Capability class |
|------------|---------|----------------------|------------------|
| `super_admin` | Super Admin | Platform grant (Feezypay ops; future table) | n/a (platform) |
| `school_admin` | School Admin | E01 `profiles.role = school_admin` | `admin` |
| `principal` | Principal | Employment designation (or school role grant) | `teacher` + grant |
| `vice_principal` | Vice Principal | Employment designation / grant | `teacher` + grant |
| `hod` | HOD | `teacher_employments.is_hod` + `department_id` | `teacher` |
| `teacher` | Teacher | Active `teacher_employments` (non-elevated) | `teacher` |
| `student` | Student | Active `student_admissions` | `student` |
| `parent` | Parent | `parent_profiles` + `student_parent_links` | `parent` |

**Today (SHIPPED):** AuthN (§55) + AuthZ runtime (§56). Personas bind via membership / employment / profiles; server actions use `requirePermission`. Parent/student **portal UIs** still `NOT BUILT`.

### 3.2 Future personas (first-class later)

| Persona ID | Display | Intended focus |
|------------|---------|----------------|
| `accountant` | Accountant / fee clerk | E15/E16 ops without full school admin |
| `class_teacher` | Class / section teacher | Attribute on employment↔section; not always a separate role row |
| `counsellor` | Counsellor | Conduct + limited health read |
| `librarian` | Librarian | Media / document subsets |
| `receptionist` | Front office | Identity/enrollment create; no fees/marks publish |
| `custom:*` | School-defined | E03 `role_permissions` catalog |

**Extensibility:** engines check **permission keys** (`assessment.exam.publish`), not hard-coded persona names. Personas are **bundles** of keys; custom roles are alternate bundles.

### 3.3 System actors

| Actor | Notes |
|-------|-------|
| `system` | Workers, webhooks, outbox consumers — service credentials; audited |
| `ai` | E23 proposes only; acceptance runs as human persona’s permissions |

---

## 4. Permission keys (catalog sketch)

Format: `{engine_domain}.{resource}.{action}`

Examples (non-exhaustive; every matrix cell maps to one or more keys):

| Key | Engine |
|-----|--------|
| `tenant.school.read` / `tenant.school.suspend` | E01 |
| `access.session.read` | E02 |
| `authz.role.grant` / `authz.policy.read` | E03 |
| `identity.person.read` / `identity.person.edit` | E04 |
| `workforce.employment.create` / `workforce.teacher.invite` | E05 |
| `enrollment.admission.create` / `enrollment.placement.edit` | E06 |
| `config.catalog.edit` | E07 |
| `calendar.year.lock` / `calendar.year.close` | E08 |
| `structure.class.edit` / `structure.promotion.approve` | E09 |
| `timetable.grid.publish` | E10 |
| `assessment.exam.publish` / `assessment.results.lock` | E11 |
| `attendance.record.create` | E12 |
| `conduct.incident.create` / `conduct.incident.approve` | E13 |
| `health.profile.edit` | E14 |
| `fee.invoice.create` / `fee.waiver.approve` | E15 |
| `payment.refund.approve` | E16 |
| `engagement.event.publish` | E17 |
| `communication.announcement.publish` | E18 |
| `notification.delivery.read` | E19 |
| `document.artifact.issue` | E20 |
| `reporting.job.create` | E21 |
| `analytics.dashboard.read` | E22 |
| `ai.suggestion.accept` | E23 |
| `marketplace.listing.publish` | E24 |
| `onboarding.wizard.edit` | E25 |
| `ingestion.job.commit` | E26 |
| `media.asset.upload` | E27 |
| `audit.entry.read` | E28 |
| `curriculum.pack.read` / `edit` / `publish` / `archive` / `clone` | E30 |
| `curriculum.structure.edit` / `outcome.edit` / `resource.edit` | E30 |
| `curriculum.progress.read` / `record` | E30 |
| `assessment_framework.read` / `edit` / `publish` / `archive` / `clone` | E31 |

**E30 matrix (sketch):** teachers get pack.read + progress.*; HOD/VP/principal/school_admin get full `curriculum.*`. Dept-scope via ABAC attrs when passed.

**E31 matrix (sketch):** teachers get `assessment_framework.read`; HOD/VP/principal/school_admin get full `assessment_framework.*`. Teachers never design the framework.

| `assessment_recording.read` / `create` / `edit` / `enter_marks` | E32 |
| `assessment_recording.lock` / `unlock` | E32 |

**E32 matrix:** teachers create/edit/enter_marks until lock; HOD/admin lock/unlock. No framework structure writes.

| `grade_calculation.read` / `configure` / `run` / `publish` | E33 |

**E33 matrix:** teachers read published only; HOD/admin configure/run/publish. Teachers never calculate manually.

E03 owns the catalog tables (future). Engines declare required keys; they do not invent parallel allow lists.

---

## 5. Enforcement split — RLS vs application

### 5.1 RLS must enforce (Postgres)

| Concern | Why RLS |
|---------|---------|
| **Tenant isolation** | `school_id` in actor’s membership set (admin profile / employment / admission / parent→child school) |
| **Self identity** | `persons.auth_user_id = auth.uid()` for own row |
| **No global person dump** | School staff see persons only via school links (current rule — keep) |
| **Coarse portal class** | Optional: student cannot `INSERT` into `exam_definitions` even if app bug |
| **Storage paths** | Media bucket policies by `school_id` prefix |
| **Deny by default** | Tables enable RLS; no policy ⇒ no access |

RLS answers: *“Is this row in a school (or self) this auth user is allowed to touch at all?”*

### 5.2 Application / E03 must enforce

| Concern | Why app |
|---------|---------|
| **Action verbs** beyond CRUD | Approve, lock, publish, archive |
| **Attribute scope** | HOD department, class teacher section, subject eligibility, linked children only |
| **Workflow state** | Cannot edit when locked/published/archived |
| **Cross-engine commands** | Fee waiver after attendance breach — permission on E15 + business rules |
| **UI route gates** | Hide nav; still re-check on server actions |
| **Multi-role session** | Active persona switch (teacher vs parent) |
| **Super-admin break-glass** | Impersonation / support tools with audit |
| **AI accept** | Run as accepting human’s keys |

App answers: *“Given they can see the tenant, may they perform this action on this resource now?”*

### 5.3 Pattern (target)

```text
1. AuthN (E02) → auth.uid()
2. Resolve person + memberships + persona grants (E03 read model)
3. Server action: assert permission key + attributes
4. Query: RLS still filters rows (defense in depth)
5. On deny: no row leak; structured reason for UX
```

**Never** rely on RLS alone for publish/approve. **Never** skip RLS because the app already checked.

### 5.4 Service role

Service role (invites, webhooks) bypasses RLS — **only** in narrow Access/Notification/Payment adapters, always audited (E28). Product server actions use the user JWT.

---

## 6. Bootstrap & multi-role rules

| Rule | Detail |
|------|--------|
| **School Admin bootstrap** | New school: E01 `profiles` grants full school ● without requiring employment (breaks E03↔E05 cycle) |
| **Elevated staff** | Principal / VP / HOD require active employment (or explicit school grant) at that school |
| **Invite path** | Employment `invited` → limited self profile edit only until `active` + `profile_completed_at` |
| **Multi-role** | Same human may be Teacher at School A and Parent at School B; session picks `school_id` + active persona |
| **Deny escalation** | Teachers cannot grant `school_admin`; only Super Admin / School Admin (policy) |
| **Year lock** | When `calendar.academic_year.closed`, Create/Edit on year-scoped academics → deny unless unlock permission |

---

## 7. Engine permission matrices

Legend: columns = personas (`SA` Super Admin, `Adm` School Admin, `Pri` Principal, `VP` Vice Principal, `HOD`, `Tch` Teacher, `Stu` Student, `Par` Parent).  
Cells = scope codes from §2.4. Empty notes under each engine call out specials.

### 7.1 E01 — Tenancy

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ● | ●* | ●* |
| Create | ◇ | —† | — | — | — | — | — | — |
| Edit | ◇ | ●‡ | ◐‡ | — | — | — | — | — |
| Delete | ◇ | — | — | — | — | — | — | — |
| Approve | ◇ | — | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

\*Public school name/logo only. †School Create = signup intent (`create_school`), not in-app for staff. ‡Lifecycle fields (suspend, plan) Adm/SA; branding may sit on E07.  
**RLS:** `schools` via membership. **App:** suspend/archive; platform create.

### 7.2 E02 — Access (AuthN)

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ◐§ | ◐§ | ◐§ | ◐§ | Self | Self | Self |
| Create | ◇ | Invite‖ | — | — | — | — | — | — |
| Edit | ◇ | — | — | — | — | Self¶ | Self¶ | Self¶ |
| Delete | ◇ | — | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | — | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | — | — | — | — | — | — | — |

§Session/audit of school users limited. ‖Invite triggers Auth user creation (service). ¶Password change / MFA self.  
**RLS:** Auth tables owned by Supabase. **App:** invite orchestration; lock = disable login.

### 7.3 E03 — Authorization (RBAC)

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | Self | Self | Self |
| Create | ◇ | ●# | ◐# | — | — | — | — | — |
| Edit | ◇ | ● | ◐ | — | — | — | — | — |
| Delete | ◇ | ● | — | — | — | — | — | — |
| Approve | ◇ | ● | ◐ | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | ◇ | ● | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

#Custom roles / grants; Pri may propose limited teaching grants.  
**RLS:** future `role_permissions` school-scoped. **App:** evaluate every server action; cannot self-grant admin.

### 7.4 E04 — Identity

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ●** | ●** | ●** | ◐** | ◐** | Self | Linked |
| Create | ◇ | ● | ● | ● | ◐ | — | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | Self†† | Self†† | Self†† |
| Delete | ◇ | —‡‡ | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

**Via school links only (no global browse). ††Non-sensitive self fields; medical → E14. ‡‡No hard-delete persons; withdraw links instead.  
**RLS:** link-or-self SELECT/UPDATE. **App:** match/merge; Aadhaar never in client logs.

### 7.5 E05 — Workforce

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Create | ◇ | ● | ● | ● | ◐ | — | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | Self§§ | — | — |
| Delete | ◇ | ●‖‖ | ●‖‖ | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | ◐ | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | ● | ● | ◐ | — | — | — |

§§Own employment non-HR fields. ‖‖End employment = archive preferred over delete. Invite = Create+Notify.  
**RLS:** `teacher_employments.school_id`. **App:** HOD limited to department; designation changes Adm/Pri.

### 7.6 E06 — Enrollment

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | Self | Linked |
| Create | ◇ | ● | ● | ● | — | — | — | — |
| Edit | ◇ | ● | ● | ● | — | ◐¶¶ | Self†† | Linked†† |
| Delete | ◇ | ●‖‖ | ●‖‖ | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | ● | ● | — | — | — | — |

¶¶Class teacher: placement notes within section only. Transfer/withdraw = Approve+Archive pattern.  
**RLS:** admissions by school; parents via links. **App:** capacity rules; year placement integrity.

### 7.7 E07 — Configuration

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ● | ● | ● |
| Create | ◇ | ● | ● | ◐ | — | — | — | — |
| Edit | ◇ | ● | ● | ◐ | — | — | — | — |
| Delete | ◇ | ● | ◐ | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | ● | ◐ | — | — | — | — |

Subjects/houses/clubs catalogs; fee heads are **E15**, not E07.  
**RLS:** school_id. **App:** lock catalog during active term if configured.

### 7.8 E08 — Calendar

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ● | ● | ● |
| Create | ◇ | ● | ● | ● | — | — | — | — |
| Edit | ◇ | ● | ● | ● | — | — | — | — |
| Delete | ◇ | ● | ● | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | ● | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

**Academic Year Closed** = Lock + Archive year; fans out via `calendar.academic_year.closed`.  
**RLS:** year/term/holiday by school. **App:** close-year workflow (multi-engine).

### 7.9 E09 — Structure

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|----|
| Read | ◇ | ● | ● | ● | ● | ● | ● | ● |
| Create | ◇ | ● | ● | ● | — | — | — | — |
| Edit | ◇ | ● | ● | ● | — | — | — | — |
| Delete | ◇ | ● | ◐ | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

Promotion requests: Create by Pri/Adm; Approve by Pri/Adm.  
**RLS:** classes/sections school-scoped. **App:** capacity invariants.

### 7.10 E10 — Timetable

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ◐ | ◐ | Linked |
| Create | ◇ | ● | ● | ● | ◐ | — | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐## | — | — |
| Delete | ◇ | ● | ● | — | ◐ | — | — | — |
| Approve | ◇ | ● | ● | ● | ◐ | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | ● | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

##Lesson plan for own slots; not full grid. HOD: department subjects.  
**RLS:** school + optional section filters. **App:** publish makes student/parent visible; eligibility vs E05 subjects.

### 7.11 E11 — Assessment

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | ◐*** | Linked*** |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Delete | ◇ | ● | ● | — | ◐ | Draft | — | — |
| Approve | ◇ | ● | ● | ● | ◐ | — | — | — |
| Lock | ◇ | ● | ● | ● | ◐ | — | — | — |
| Publish | ◇ | ● | ● | ● | ◐ | — | — | — |
| Archive | ◇ | ● | ● | ● | ◐ | — | — | — |

***Results only after publish (or school policy). Marks entry = Edit results ◐ by subject teacher.  
**RLS:** definitions by school; results join enrollment. **App:** publish/lock; Exam Published event.

### 7.12 E12 — Attendance

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | Self | Linked |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Delete | ◇ | ● | ● | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

**RLS:** by school + section. **App:** threshold breach → fee/communication commands; same-day edit windows.

### 7.13 E13 — Conduct

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | Self††† | Linked††† |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Delete | ◇ | ● | ● | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | ◐ | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | ● | ● | — | — | — | — |

†††Sanitized / policy-gated visibility.  
**RLS:** school-scoped. **App:** severity approve; parent notify.

### 7.14 E14 — Health

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ●‡‡‡ | ●‡‡‡ | ●‡‡‡ | — | ◐‡‡‡ | Self | Linked |
| Create | ◇ | ● | ● | — | — | — | — | Linked |
| Edit | ◇ | ● | ● | — | — | — | Self†† | Linked |
| Delete | ◇ | ● | — | — | — | — | — | — |
| Approve | ◇ | ● | ● | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

‡‡‡Need-to-know (trip clearance, allergy flags) — stricter than normal academics. Teachers: emergency flags only if granted.  
**RLS:** separate policies; optional column grants. **App:** consent + trip clearance.

### 7.15 E15 — Fee

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | — | — | Self | Linked |
| Create | ◇ | ● | ◐ | — | — | — | — | — |
| Edit | ◇ | ● | ◐ | — | — | — | — | — |
| Delete | ◇ | ● | — | — | — | — | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

Future `accountant` → ● on Read/Create/Edit; Approve waivers still Adm/Pri.  
**RLS:** invoices by school; parent/student own. **App:** ledger posts; waiver approve; never let Payments write ledger.

### 7.16 E16 — Payments

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | — | — | Self | Linked |
| Create | ◇ | ● | — | — | — | — | ●§§§ | ●§§§ |
| Edit | ◇ | — | — | — | — | — | — | — |
| Delete | — | — | — | — | — | — | — | — |
| Approve | ◇ | ● | ● | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

§§§Initiate own payment intent. Refunds = Approve. Provider webhooks = `sys`.  
**RLS:** own transactions + school staff. **App:** reconcile; emit `payment.*` only.

### 7.17 E17 — Event (engagement)

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ● | ● | ● |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Delete | ◇ | ● | ● | — | ◐ | Draft | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | ● | ◐ | — | — | — |
| Archive | ◇ | ● | ● | ● | ◐ | — | — | — |

**RLS:** school audience. **App:** publish → communication; complete → `engagement.event.completed`.

### 7.18 E18 — Communication

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | ◐ | ◐ |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Delete | ◇ | ● | ● | — | ◐ | Draft | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | ◇ | ● | ● | ● | ◐ | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

Content ownership here; delivery is E19.  
**RLS:** school + audience. **App:** consent checks before publish.

### 7.19 E19 — Notification

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | Self | Self | Self |
| Create | sys | sys | — | — | — | — | — | — |
| Edit | sys | — | — | — | — | — | — | — |
| Delete | — | — | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Humans don’t “send” raw; they Publish in E18 → E19 delivers. Preference edit = Self.  
**RLS:** own notification rows. **App:** retries; provider adapters (`sys`).

### 7.20 E20 — Document

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | Self | Linked |
| Create | ◇ | ● | ● | ● | — | ◐ | — | — |
| Edit | ◇ | ● | ● | — | — | Draft | — | — |
| Delete | ◇ | ● | — | — | — | Draft | — | — |
| Approve | ◇ | ● | ● | ● | — | — | — | — |
| Lock | ◇ | ● | ● | — | — | — | — | — |
| Publish | ◇ | ● | ● | ● | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | — | — | — |

Issue certificate / report card = Create+Publish. Teachers **fill** assigned narrative fields only (`document.report_card.fill`); they do not design templates or publish.  
**RLS:** by school + subject person. **App:** template render; TC after transfer approve; pin E33 runs on assemble.

### 7.21 E21 — Reporting

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | ◇ | ● | — | — | — | — | — | — |
| Delete | ◇ | ● | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | — | — | — | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Read-only over OLTP; Create = run export job. Fee reports may require fee read key.  
**RLS:** job rows by school. **App:** dataset permission intersection.

### 7.22 E22 — Analytics

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Create | sys | — | — | — | — | — | — | — |
| Edit | — | — | — | — | — | — | — | — |
| Delete | — | — | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | — | — | — | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

**RLS:** aggregated school metrics. **App:** PII minimization; Publish = share dashboard link.

### 7.23 E23 — AI

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| Edit | — | — | — | — | — | — | — | — |
| Delete | ◇ | ● | — | — | — | Self | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Create = request suggestion. **Accept** = app action that runs **target engine’s** Create/Edit under the human’s keys (not a free AI write).  
**RLS:** suggestion rows by school/user. **App:** hard deny OLTP writes from propose path.

### 7.24 E24 — Marketplace

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | — | — | — | Self/Public | Public | Public |
| Create | ◇ | — | — | — | — | Self | — | — |
| Edit | ◇ | — | — | — | — | Self | — | — |
| Delete | ◇ | — | — | — | — | Self | — | — |
| Approve | ◇ | — | — | — | — | — | — | — |
| Lock | ◇ | — | — | — | — | — | — | — |
| Publish | ◇ | — | — | — | — | Self | — | — |
| Archive | ◇ | — | — | — | — | Self | — | — |

Opt-in teacher public profile; school Adm may Read school-linked listings only.  
**RLS:** public read vs owner write. **App:** verification Approve = SA.

### 7.25 E25 — Onboarding

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | — | — | — | — | — | — |
| Create | ◇ | ● | — | — | — | — | — | — |
| Edit | ◇ | ● | — | — | — | — | — | — |
| Delete | — | — | — | — | — | — | — | — |
| Approve | ◇ | ● | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Wizard only for School Admin (today). Completing Review → `tenant.onboarding.completed`.  
**RLS:** school of Adm. **App:** step gates; feature lock until complete.

### 7.26 E26 — Ingestion

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ◐ | — | — | — |
| Create | ◇ | ● | ● | ● | ◐ | — | — | — |
| Edit | ◇ | ● | ● | — | — | — | — | — |
| Delete | ◇ | ● | — | — | — | — | — | — |
| Approve | ◇ | ● | ● | — | — | — | — | — |
| Lock | — | — | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Commit import requires same Create permission on target engine (staff CSV → E05 keys). Blocking validation = app.  
**RLS:** job by school. **App:** all-or-nothing CSV (D3).

### 7.27 E27 — Media

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | ● | ◐ | Self | Linked |
| Create | ◇ | ● | ● | ● | ◐ | ◐ | Self | Linked |
| Edit | ◇ | ● | ● | — | — | Self | Self | Self |
| Delete | ◇ | ● | ● | — | — | Self | Self | Self |
| Approve | ◇ | ● | — | — | — | — | — | — |
| Lock | ◇ | ● | — | — | — | — | — | — |
| Publish | ◇ | ● | ● | — | — | — | — | — |
| Archive | ◇ | ● | ● | — | — | Self | — | — |

**RLS:** storage policies by path/`school_id`. **App:** virus scan; max size; logo vs private docs.

### 7.28 E28 — Audit

| Action | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| Read | ◇ | ● | ● | ● | — | — | — | — |
| Create | sys | sys | sys | sys | sys | sys | sys | sys |
| Edit | — | — | — | — | — | — | — | — |
| Delete | — | — | — | — | — | — | — | — |
| Approve | — | — | — | — | — | — | — | — |
| Lock | ◇ | — | — | — | — | — | — | — |
| Publish | — | — | — | — | — | — | — | — |
| Archive | ◇ | ● | — | — | — | — | — | — |

Immutable append; humans never Edit/Delete.  
**RLS:** school admins read school audit; SA platform. **App:** every sensitive command emits audit.

---

## 8. Compact persona × engine summary

High-level default power (Read / Mutate where Mutate = any of Create·Edit·Delete·Approve·Lock·Publish·Archive):

| Engine | SA | Adm | Pri | VP | HOD | Tch | Stu | Par |
|--------|----|-----|-----|----|-----|-----|-----|-----|
| E01 Tenancy | ◇ full | ● strong | read+brand | read | read | read | limited | limited |
| E02 Access | ◇ | invite | — | — | — | self | self | self |
| E03 AuthZ | ◇ | ● roles | limited | — | — | self | self | self |
| E04 Identity | ◇ | ● | ● | ● | ◐ | self/◐ | self | linked |
| E05 Workforce | ◇ | ● | ● | ● | ◐ | self | — | — |
| E06 Enrollment | ◇ | ● | ● | ● | ◐ read | ◐ | self | linked |
| E07 Config | ◇ | ● | ● | ◐ | read | read | read | read |
| E08 Calendar | ◇ | ● | ● | ● | read | read | read | read |
| E09 Structure | ◇ | ● | ● | ● | read | read | read | read |
| E10 Timetable | ◇ | ● | ● | ● | ◐ | ◐ | ◐ | linked |
| E11 Assessment | ◇ | ● | ● | ● | ◐ | ◐ | after pub | after pub |
| E12 Attendance | ◇ | ● | ● | ● | ◐ | ◐ | self | linked |
| E13 Conduct | ◇ | ● | ● | ● | ◐ | ◐ | limited | limited |
| E14 Health | ◇ | ● need | ● need | limited | — | flags | self | linked |
| E15 Fee | ◇ | ● | ◐+approve | approve | — | — | self | linked |
| E16 Payments | ◇ | ● | read+refund | read | — | — | pay | pay |
| E17 Events | ◇ | ● | ● | ● | ◐ | ◐ | read | read |
| E18 Comms | ◇ | ● | ● | ● | ◐ | ◐ | read | read |
| E19 Notify | ◇ | ● ops | read | read | — | self | self | self |
| E20 Docs | ◇ | ● | ● | ● | ◐ | ◐ | self | linked |
| E21 Reporting | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| E22 Analytics | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| E23 AI | ◇ | ● | ● | ● | ◐ | ◐ | — | — |
| E24 Market | ◇ | read | — | — | — | own | public | public |
| E25 Onboard | ◇ | ● | — | — | — | — | — | — |
| E26 Ingest | ◇ | ● | ● | ● | ◐ | — | — | — |
| E27 Media | ◇ | ● | ● | ● | ◐ | ◐ | self | linked |
| E28 Audit | ◇ | ● | ● | ● | — | — | — | — |

---

## 9. Default role bundles (permission key sets)

Illustrative — exact key lists live in E03 catalog when implemented.

| Persona | Includes (intent) |
|---------|-------------------|
| **Super Admin** | All `tenant.*` platform keys; break-glass read; marketplace verify; no silent school mutate without audit |
| **School Admin** | All school ● keys except platform suspend of other tenants; full onboarding; fee+payment ops; role grants |
| **Principal** | Academic + structure + calendar close; workforce/enrollment; assessment publish; fee waiver approve; not SaaS billing |
| **Vice Principal** | Principal minus year-close lock and destructive deletes; strong academics/ops |
| **HOD** | Department workforce read/edit; assessment/timetable for dept subjects; no school-wide fee |
| **Teacher** | Own timetable/lesson plans; attendance/marks for assigned sections/subjects; read school calendars |
| **Student** | Self enrollment/timetable/attendance/results (policy); initiate payment; own media |
| **Parent** | Linked children mirrors of student reads + pay fees + limited health edit |
| **Accountant** (future) | `fee.*` + `payment.read` + reporting finance; no assessment publish |

---

## 10. Attribute rules (ABAC add-ons)

| Attribute | Effect |
|-----------|--------|
| `is_hod` + `department_id` | Narrows HOD ● → department ◐ |
| `employment_subjects` | Teacher may Edit assessment/attendance only for those subjects |
| Class/section teacher assignment | Placement notes, section attendance defaults |
| `student_parent_links` | Parent Read/Pay limited to linked admissions |
| `employment.status` | `invited` → Identity self Edit only |
| `academic_year.status=closed` | Blocks Create/Edit unless `calendar.year.unlock` |
| Assessment `published` | Unlocks Student/Parent Read on results |

---

## 11. Mapping to implementation phases

| Phase | Work | Doc refs |
|-------|------|----------|
| RBAC-0 | Implicit Adm via `profiles` (current) | MASTER §7.4 |
| RBAC-1 | Teacher invite + auth bind + first login | F6, F11 |
| RBAC-2 | This matrix + permission keys + server guards | **This file**; F9 |
| RBAC-3 | Parent portal (linked scope) | F10 |
| RBAC-4 | Student portal | F10 |
| RBAC-5 | Multi-role session switcher | `person_roles` |
| RBAC-6 | Custom school roles + accountant | E03 catalog |

---

## 12. RLS policy inventory (target)

| Area | Policy idea |
|------|-------------|
| School-scoped tables | `school_id IN membership_schools(auth.uid())` |
| `persons` | Self OR linked via employment/admission/parent |
| Fee/payment | Staff with fee keys OR payer person OR linked parent |
| Health | Staff with health keys OR self/parent; teachers emergency subset |
| Audit | Adm/Pri/VP/SA only |
| Marketplace public | `status=published` SELECT for anon/auth |
| Media | Path prefix school_id + owner |

Helper SQL (future): `authz.membership_schools()`, `authz.has_permission(uid, school, key)`, kept in sync with app evaluator.

---

## 13. Relation to other docs

| Doc | Role |
|-----|------|
| `business-engines.md` E03 | Engine responsibilities; this file is the matrix |
| `domain-model.md` | Resources being authorized |
| `system-events.md` | Emits after authorized writes |
| `versioning.md` | Lock/archive/version semantics for what those writes may mutate |
| `audit-log.md` | Immutable who/what/when for authorized writes |
| `notification-engine.md` | Delivery after authorized domain events |
| `ai-architecture.md` | Assistive layer; accept uses human AuthZ |
| `MASTER.md` §7 / §21 | Roadmap + index |

---

## 14. Maintenance

| Change | Action |
|--------|--------|
| New persona | Add column to §7 matrices + bundle in §9 |
| New engine action | Add permission key + matrix row |
| RLS vs app dispute | Prefer RLS for tenancy; app for verb/scope |
| Custom role | Bundle existing keys only — do not invent engine backdoors |

---

*End of RBAC architecture. Companion: MASTER §21.*
