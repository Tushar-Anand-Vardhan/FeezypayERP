# Principal Dashboard

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend aggregator `SHIPPED`. Minimal UI `SHIPPED`. Principal persona login still designation/grant FUTURE.  
> **Module:** `lib/principal-dashboard/**`  
> **UI:** `/dashboard/principal`  
> **Migration:** none (read-only aggregate over existing engines)  
> **Companions:** [`teacher-workspace.md`](teacher-workspace.md) · [`student-analytics-engine.md`](student-analytics-engine.md) · [`teacher-analytics-engine.md`](teacher-analytics-engine.md) · MASTER §53  
> **Workflows:** WF-PRI-01 … WF-PRI-09 · WF-VP-01

---

## 1. Purpose

School-wide **ops homepage** for Principal / Admin morning review. Every panel is filled from **live OLTP** — never hardcoded demo rows. Empty panels when no data.

| Rule | Meaning |
|------|---------|
| P1 | Data-driven only — cite `sourceTables` per panel |
| P2 | Writes stay in owning engines; dashboard is read aggregation |
| P3 | Teacher attendance = **marking completion proxy** until staff attendance OLTP exists |
| P4 | School health indicators are deterministic thresholds (no AI) |
| P5 | Admin may open the page today; Principal designation/grant later |

---

## 2. Panels

| Panel | Sources |
|-------|---------|
| School attendance | `attendance_records` / `attendance_sessions` (as-of date) |
| Teacher attendance | Timetable sections vs sessions marked; active employments |
| Student performance | Published/locked `exam_results` averages |
| Department performance | Departments + memberships + dept subjects + marks |
| Upcoming events | Approved/published `calendar_events` |
| Pending approvals | Pending events, leave, high-severity conduct, draft mark sessions |
| Pending report cards | `report_card_issues` status=`draft` |
| Pending assessments | Draft mark sessions + published exams with zero results |
| Notifications | Recent `notification_delivery_requests` |
| School health | Deterministic composite from the above |

---

## 3. API

| Action | Role |
|--------|------|
| `getPrincipalDashboardAction({ asOfDate?, academicYearId? })` | Full aggregate |

---

## 4. Placement

- Cite WF-PRI-01 (morning ops review) as primary.  
- Do not store dashboard snapshots.  
- After Principal login exists, post-login home may route here.

---

## 5. Tests

`npx tsx scripts/smoke-principal-dashboard-validation.ts`
