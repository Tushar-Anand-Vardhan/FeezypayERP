# Principal Dashboard

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Updated:** 2026-08-12 — Wave 2 ops + Wave 4 enroll/rolls  
> **Status:** Backend aggregator `SHIPPED`. Minimal UI `SHIPPED`. Wave 2 write shell `SHIPPED`. Wave 4 enroll `SHIPPED`. Principal persona login still designation/grant FUTURE.  
> **Module:** `lib/principal-dashboard/**` · `lib/principal-portal/**` · `lib/principal-ops/**` · `lib/enrollment/**`  
> **UI:** `/dashboard/principal/**`  
> **Migration:** Wave 4 affiliation uniques (`20260807530000_wave4_affiliation_uniques.sql`)  
> **Companions:** [`teacher-workspace.md`](teacher-workspace.md) · MASTER §53 · §68  
> **Workflows:** WF-PRI-01 … WF-PRI-10 · WF-VP-01

---

## 1. Purpose

School-wide **ops homepage** for Principal / Admin morning review, plus Wave 2–4 school ops tabs.

| Rule | Meaning |
|------|---------|
| P1 | Data-driven panels only — cite `sourceTables` per panel |
| P2 | Overview panels do not write OLTP |
| P3 | Wave 2 mutations live in `lib/principal-ops/**` |
| P3b | Wave 4 placement/rolls live in `lib/enrollment/**` |
| P4 | Teacher attendance = marking completion proxy until staff attendance OLTP exists |
| P5 | School health indicators are deterministic thresholds (no AI) |

---

## 2. Routes

| Route | Permission | Notes |
|-------|------------|-------|
| `/dashboard/principal` | `analytics.dashboard.read` | Overview panels |
| `/dashboard/principal/teachers` | `workforce.employment.read` | Edit needs `.edit` |
| `/dashboard/principal/students` | `enrollment.admission.read` | Withdraw needs `.edit` |
| `/dashboard/principal/enroll` | `enrollment.admission.read` | Place/rolls need `enrollment.placement.edit` |
| `/dashboard/principal/promote` | `enrollment.placement.edit` | EOY batch |

---

## 3. Panels

| Panel | Sources |
|-------|---------|
| School attendance | `attendance_records` / `attendance_sessions` |
| Teacher attendance | Timetable sections vs sessions marked |
| Student performance | Published/locked `exam_results` averages |
| Department performance | Departments + memberships + marks |
| Upcoming events | Approved/published `calendar_events` |
| Pending approvals | Events, leave, conduct, draft mark sessions |
| Pending report cards | `report_card_issues` status=`draft` |
| Pending assessments | Draft mark sessions + exams without results |
| Notifications | Recent `notification_delivery_requests` |
| School health | Deterministic composite |

---

## 4. Wave 2 APIs (`lib/principal-ops`)

| Action | Role |
|--------|------|
| `endTeacherEmploymentAction` | End employment + clear class teacher + membership sync |
| `setEmploymentSubjectsAction` | Replace subjects; conflict if slots use removed subjects unless `force` |
| `setSectionClassTeacherAction` | Assign class teacher; overwrite requires `force` |
| `withdrawStudentAction` | Admission withdrawn + placements closed + membership sync |
| `applyPromotionBatchAction` | Promote / repeat / graduate batch |

---

## 5. Placement

- Cite WF-PRI-01 for overview; WF-PRI-10 for promote.  
- Do not store dashboard snapshots.  
- After Principal login exists, post-login home may route here.

---

*Companion: MASTER §53 · §68.*
