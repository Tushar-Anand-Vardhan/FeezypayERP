# FeezypayERP — Department Engine (E05 surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E05 Workforce** (department org surface)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md)

---

## 1. Hard rule

**Departments never own teachers.**

| Owns | Does not own |
|------|----------------|
| Department catalog row | `persons` / `teacher_profiles` |
| Memberships → `teacher_employments` | Teacher PII |
| Subject links → E07 `subjects` ids | Subject catalog definitions |
| Teaching assignment relationships | Timetable slots (E10) / eligibility-only (`employment_subjects`) |
| Announcements / resources / history | Notification delivery (E19) |

Teachers belong to **Person** (E04). Departments own **relationships**.

---

## 2. Schema

Migration: `supabase/migrations/20260807140000_department_engine.sql`

| Table | Purpose |
|-------|---------|
| `departments` | Enriched: code, description, parent stub, cost center stub, created_by/updated_by, archive |
| `department_memberships` | head / coordinator / member ↔ employment; dated history |
| `department_subjects` | Which catalog subjects the dept organizes |
| `department_teaching_assignments` | Dept-scoped employment↔subject relationships |
| `department_announcements` | Draft/publish/retract; `notify_on_publish` stub |
| `department_resources` | link/file/note; `media_id` E27 stub |
| `department_history` | Append-only edit trail |

Compatibility: membership writes sync `teacher_employments.department_id` + `is_hod` for onboarding until staff UI uses memberships only.

---

## 3. Module

```text
lib/departments/
  types.ts
  codes.ts
  validation.ts
  server-helpers.ts
  departments-actions.ts
  memberships-actions.ts
  subjects-actions.ts
  teaching-assignments-actions.ts
  announcements-actions.ts
  resources-actions.ts
```

---

## 4. Tests

`npx tsx scripts/smoke-department-validation.ts`

---

## 5. Out of scope (this slice)

- Admin UI  
- Nested department UX  
- E18/E19 publish fan-out  
- E27 media uploads  
- Rewiring onboarding staff save fully onto membership APIs  

---

*Implementation notes live in MASTER §30.*
