# Attendance Engine (E12)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. Period-attendance **schema-ready / API stubbed**.  
> **Module:** `lib/attendance/**`  
> **Migration:** `supabase/migrations/20260807250000_attendance_engine.sql`  
> **Companions:** [`business-engines.md`](business-engines.md) · [`versioning.md`](versioning.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §44

---

## 1. Purpose

Own **presence facts** for students. Teachers mark attendance; after **approve** or **lock**, teachers cannot freely edit. Approved/locked facts become **visible to parents and students** automatically (no duplicate stores).

| Rule | Meaning |
|------|---------|
| P1 | No student names / phones on attendance rows — IDs only |
| P2 | Append / compensate after lock — no silent rewrite of meaning |
| P3 | Session owns bulk day (or period) lifecycle: draft → submitted → approved → locked |
| P4 | Corrections after approve/lock create compensating rows + audit |
| P5 | Analytics are **derived** queries — not a second SoT |
| P6 | Period attendance columns exist; full period UX is FUTURE |

---

## 2. Tables

| Table | Role |
|-------|------|
| `attendance_sessions` | Section + date (+ optional period) batch; workflow + lock/approve |
| `attendance_records` | Per-student fact (enriched from SCHEMA-READY stub) |
| `attendance_leave_requests` | Leave applications spanning dates |
| `attendance_audit_log` | Engine-local audit of mark/correct/approve/lock |

---

## 3. Status & workflow

**Mark statuses:** `present` · `absent` · `late` · `half_day` · `excused` · `leave`

**Session workflow:** `draft` → `submitted` → `approved` → `locked`  
Teacher may edit while `draft` or `submitted` and not locked.  
After `approved` or `locked`, teacher edits denied; use **correction** (admin/approver) which writes compensating fact + audit.

**Visibility:** On approve/lock, `visible_to_guardians` and `visible_to_students` default **true** so Student Profile / future portals can read automatically.

---

## 4. API (`lib/attendance`)

| Action | Notes |
|--------|-------|
| `upsertDailyAttendanceAction` | Single student daily mark |
| `bulkMarkDailyAttendanceAction` | Section roster bulk |
| `markPeriodAttendanceAction` | Stubbed — returns FUTURE unless `enablePeriodAttendance` |
| `submitAttendanceSessionAction` | draft → submitted |
| `approveAttendanceSessionAction` | submitted → approved; opens guardian/student visibility |
| `lockAttendanceSessionAction` / `unlock…` | Freeze / admin unlock |
| `correctAttendanceAction` | Compensating correction when locked/approved |
| `createLeaveRequestAction` / `decideLeaveRequestAction` | Leave |
| `listSectionAttendanceAction` | Teacher/admin |
| `listStudentAttendanceAction` | Optional `visibleOnly` for parent/student |
| `getAttendanceAnalyticsAction` | Counts / rates by section or student |
| `listAttendanceAuditAction` | Audit trail |

---

## 5. Placement

- WF-TCH-01 mark attendance; WF-PAR-01 / WF-STU-03 consume visible facts.  
- Fee fines stay E15 (emit threshold events later).  
- Student Profile `attendance` module already reads `attendance_records`.

---

## 6. Tests

`npx tsx scripts/smoke-attendance-validation.ts`
