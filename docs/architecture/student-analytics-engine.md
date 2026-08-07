# Student Analytics Engine (E22 — student slice)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. AI `NOT IN SCOPE` (deterministic only).  
> **Module:** `lib/student-analytics/**`  
> **Migration:** `supabase/migrations/20260807320000_student_analytics_engine.sql`  
> **Companions:** [`business-engines.md`](business-engines.md) E22 · [`ai-architecture.md`](ai-architecture.md) (consumer later) · MASTER §51  
> **Workflows:** WF-PRI-01 · WF-VP-01 · WF-PAR-06 (consume) · WF-ADM-08 (thresholds)

---

## 1. Purpose

Produce **deterministic student analytics** by aggregating live OLTP from owning engines. Generate strengths, weaknesses, risk indicators, and progress graph series. **No AI.** Same inputs → same outputs.

| Rule | Meaning |
|------|---------|
| P1 | Analytics **never writes** attendance / marks / behaviour / enrollment facts |
| P2 | Snapshots are regenerate-able marts — not a second SoT |
| P3 | Thresholds are documented constants (`ANALYTICS_THRESHOLDS`) |
| P4 | Insights carry `code` + `evidence` for auditability |
| P5 | E23 may narrate later — must not invent scores here |
| P6 | Student Profile remains the identity aggregate; this engine owns metrics |

---

## 2. Aggregates (sources)

| Aggregate | Source engine / tables |
|-----------|------------------------|
| Attendance | E12 `attendance_records` |
| Assessment performance | E11 `exam_results` |
| Subject trends | E11 results grouped by `subject_id` (+ trend delta) |
| Participation | E17 `event_participants` (+ year via `calendar_events`) |
| Behaviour | E13 `conduct_incidents` |
| Achievements | Event awards + conduct commendations + high subject averages |
| Teacher remarks | Assessment remarks · behaviour titles · homework feedback |

---

## 3. Generated outputs

| Output | How |
|--------|-----|
| Strengths | Rule codes (`attendance.excellent`, `subject.strong.*`, …) |
| Weaknesses | Rule codes (`attendance.watch`, `subject.weak.*`, …) |
| Risk indicators | Rule codes (`attendance.chronic_absence`, `assessment.failing_risk`, …) |
| Progress graphs | `attendanceByMonth`, `assessmentByExam`, `subjectTrends[].points` |

Default thresholds (v1.0.0): attendance risk `<75%`, watch `<85%`, strength `≥95%`; subject strength `≥75%`, weak `<50%`, risk `<40%`; disciplinary pattern `≥2`; etc. — see `ANALYTICS_THRESHOLDS`.

---

## 4. Tables

| Table | Role |
|-------|------|
| `student_analytics_snapshots` | Optional persisted report (aggregates + insights + graphs) |
| `student_analytics_audit_log` | Generate / snapshot audit |

---

## 5. API

| Action | Notes |
|--------|-------|
| `generateStudentAnalyticsAction` | Compute report; optional `persistSnapshot` |
| `getLatestStudentAnalyticsSnapshotAction` | Read latest mart row |
| `listStudentAnalyticsSnapshotsAction` | History |
| `listStudentRiskIndicatorsAction` | Year risk rollup from latest snapshots |
| `buildStudentAnalyticsReport` / `deriveInsights` | Pure helpers |

---

## 6. Placement

- Reads E11/E12/E13/E17/Homework — never owns their rows  
- School-wide warehouse / fee collection dashboards remain future E22 slices  
- AI narration is E23 only after this mart exists  

---

## 7. Tests

`npx tsx scripts/smoke-student-analytics-validation.ts`
