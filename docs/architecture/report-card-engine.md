# Report Card Engine (E20 issue / generation)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. PDF bytes `NOT BUILT` (render job queued only).  
> **Module:** `lib/report-cards/**` (ops + templates)  
> **Migration:** `supabase/migrations/20260807270000_report_card_engine.sql`  
> **Companions:** [`report-card-template-engine.md`](report-card-template-engine.md) · [`versioning.md`](versioning.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §46

---

## 1. Purpose

Generate **official report cards** dynamically from owning engines. Pin a **template version**. Keep **issue version history**. Never create a parallel marks OLTP.

| Rule | Meaning |
|------|---------|
| P1 | Grades come from E11 `exam_results` (ids in `source_refs`) |
| P2 | Attendance from E12; behaviour from E13 stub; co-curricular from house/club memberships; promotion from `student_academic_years` |
| P3 | Teacher/principal **card remarks** are E20-owned narrative on the version |
| P4 | `presentation_snapshot` = derived reprint display only — not a second assessment store |
| P5 | Issued versions are immutable; reissue opens a new version |
| P6 | PDF media remains future (Media / DigiLocker) |

---

## 2. Sources assembled

| Block | Source |
|-------|--------|
| Assessment / grades / per-subject teacher remarks | E11 `exam_results` (+ exam/subject labels) |
| Attendance summary | E12 `attendance_records` aggregate |
| Co-curricular | `house_memberships`, `club_memberships` |
| Behaviour | `conduct_incidents` |
| Promotion status | `student_academic_years.promotion_status` |
| Principal / teacher remarks (card-level) | Version columns |
| Layout / bindings | E20 template + `report_card_template_versions` |

---

## 3. Tables

| Table | Role |
|-------|------|
| `report_card_issues` | Logical card (student × template × year/term) |
| `report_card_issue_versions` | Version history (`draft` → `issued` → `superseded` / `revoked`) |
| `student_issued_documents` | Enriched link for Student Profile |
| `report_card_render_jobs` | PDF queue stub (+ `report_card_issue_version_id`) |
| `report_card_audit_log` | Append-only lifecycle audit |

---

## 4. API

| Action | Notes |
|--------|-------|
| `createReportCardDraftAction` | Assemble from sources → v1 draft |
| `regenerateReportCardDraftAction` | Refresh draft from live sources; or `asNewVersion` for reissue |
| `updateReportCardRemarksAction` | Teacher / principal remarks on draft |
| `issueReportCardAction` | Freeze version; mirror issued document; queue render job |
| `revokeReportCardAction` | Revoke issue + document |
| `previewReportCardAssemblyAction` | Assemble without persist |
| `listReportCardIssuesAction` / `getReportCardIssueAction` | Queries |
| `listReportCardVersionsAction` / `getReportCardVersionAction` | Version history |
| `listReportCardAuditAction` | Audit |

---

## 5. Placement

- WF-PER-02 issue; WF-PRI-09 readiness; WF-TCH-08 remarks; WF-PAR-06 / WF-STU-06 consume.  
- Templates remain §35. Marks remain §45. Attendance remains §44.

---

## 6. Tests

`npx tsx scripts/smoke-report-card-ops-validation.ts`
