# Behaviour Engine (E13)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`.  
> **Module:** `lib/behaviour/**`  
> **Migration:** `supabase/migrations/20260807290000_behaviour_engine.sql`  
> **Table:** enriched `conduct_incidents` (+ `behaviour_follow_ups`, `behaviour_audit_log`)  
> **Companions:** [`business-engines.md`](business-engines.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §48

---

## 1. Purpose

Own **timestamped behaviour remarks and discipline records** for students. Support positive and disciplinary polarity, privacy levels, follow-ups, year filtering, and derived analytics. Student Profile / Report Cards **read by reference** — no behaviour dump on student blobs.

| Rule | Meaning |
|------|---------|
| P1 | Every remark has `recorded_at` (authoritative timestamp) |
| P2 | Filter / analytics always scoped by `academic_year_id` |
| P3 | `visibility` drives parent/student flags (`private` / `staff` / `parent_visible` / `school`) |
| P4 | Follow-ups are first-class rows linked to a remark |
| P5 | Analytics are **derived** queries — not a second SoT |
| P6 | Assessment / report-card remarks stay E11/E20 |

---

## 2. Remark kinds

| Kind | Use |
|------|-----|
| `positive` | Positive remarks |
| `disciplinary` | Disciplinary remarks |
| `warning` | Warnings |
| `commendation` | Commendations |
| `teacher_note` | Teacher notes (often `private`) |

---

## 3. Visibility

| Value | Guardians | Students |
|-------|-----------|----------|
| `private` | no | no |
| `staff` | no | no |
| `parent_visible` | yes | no |
| `school` | yes | yes |

---

## 4. Tables

| Table | Role |
|-------|------|
| `conduct_incidents` | Remarks / incidents (enriched) |
| `behaviour_follow_ups` | Follow-up actions |
| `behaviour_audit_log` | Append-only audit |

---

## 5. API

| Action | Notes |
|--------|-------|
| `createBehaviourRemarkAction` | Create timestamped remark |
| `updateBehaviourRemarkAction` / `setRemarkVisibilityAction` | Edit / visibility |
| `archiveBehaviourRemarkAction` | Soft-archive |
| `createBehaviourFollowUpAction` / update / archive | Follow-ups |
| `listBehaviourRemarksAction` | Year filter (+ kind/visibility/student) |
| `getBehaviourRemarkAction` | Remark + follow-ups |
| `getBehaviourAnalyticsAction` | Derived counts for future dashboards |
| `listBehaviourAuditAction` | Audit |

---

## 6. Placement

- WF-TCH-03 · WF-HOD-06 · WF-PRI-02 · WF-VP-02 · WF-ADM-12 · WF-SUP-COU-01 · WF-PAR-09  
- Policy thresholds remain E07 `behaviour_rules`  

---

## 7. Tests

`npx tsx scripts/smoke-behaviour-validation.ts`
