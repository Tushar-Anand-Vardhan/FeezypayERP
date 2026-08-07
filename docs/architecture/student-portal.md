# FeezypayERP — Student Portal

> **Phase:** 2.10 — Student Portal  
> **Created:** 2026-08-07  
> **Status:** Portal UI `SHIPPED` (read-only-by-default; self-scoped over Student Profile + engines).  
> **Routes:** `/dashboard/student/**`  
> **Module:** `components/student-portal/` · `lib/student-portal/`  
> **Companions:** MASTER §60 · [`student-profile-engine.md`](student-profile-engine.md) · [`rbac.md`](rbac.md) · WF-STU-* in [`daily-workflows.md`](../operations/daily-workflows.md)

---

## 1. Purpose

Students see **only** their own (or admin-previewed) data. Portal is thin UI + self-scope resolver — **no** duplicated OLTP.

| Rule | Meaning |
|------|---------|
| S1 | Entry requires `enrollment.admission.read` |
| S2 | Pages use permission keys + `<Can>` — never `role === 'student'` |
| S3 | Reads call owning engine / student-profile actions only |
| S4 | **Write allowlist v1 = empty** (no homework submit, no profile edit UI) |
| S5 | Honor `visibleOnly` / `visible_to_students` / parent visibility flags |

---

## 2. Self-scope

`resolveStudentPortalContext` (`lib/student-portal/context.ts`):

1. AuthZ actor + school from `requirePermission`.
2. Prefer linked profile: `persons.auth_user_id` → `student_profiles` → admission at school.
3. Admin / staff preview: `?studentProfileId=` only when actor is school_admin (or has school-wide enrollment read without being a pure student persona).
4. Reject mismatched ids for student persona.

---

## 3. Routes

| Route | Permission | Mode |
|-------|------------|------|
| `/dashboard/student` | `enrollment.admission.read` | RO home aggregate |
| `/attendance` | `attendance.record.read` | RO |
| `/homework` | `homework.read` | RO (no submit) |
| `/assessments` | `assessment.results.read` | RO |
| `/report-cards` | `document.report_card.read` | RO |
| `/announcements` | `communication.message.read` | RO |
| `/events` | `engagement.event.read` | RO |
| `/achievements` | `enrollment.admission.read` | RO stub |
| `/behaviour` | `conduct.incident.read` | RO visibleOnly |
| `/profile` | `identity.person.read` | RO |
| `/documents` | `enrollment.admission.read` | RO stub |
| `/ai` | `enrollment.admission.read` | Placeholder |

Query: `?studentProfileId=` for admin preview only.

---

## 4. Placement

New UI under `components/student-portal/`. Binders in `lib/student-portal/` only when engines lack self-scoped list (e.g. messages-for-me). Do not copy attendance/marks writers.

---

*Companion: MASTER §60.*
