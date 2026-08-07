# FeezypayERP — Assessment Recording Engine (E32)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E32 Assessment Recording**  
> **Companions:** [`assessment-framework-engine.md`](assessment-framework-engine.md) · [`assessment-operations-engine.md`](assessment-operations-engine.md) · [`curriculum-engine.md`](curriculum-engine.md) · [`versioning.md`](versioning.md) · [`MASTER.md`](../MASTER.md)  
> **Module:** `lib/assessment-recording/` · Migration `20260807460000_assessment_recording_engine.sql`

---

## 1. Scope

Teachers create **academic evidence**, never academic structures.

```text
Assessment Framework (E31)
  └─ Category e.g. Classwork (50%)
       └─ Teacher records (unlimited):
            Class Test 1 · Class Test 2 · Worksheet · Notebook Check ·
            Oral · Presentation · Observation · …
```

| In scope | Out of scope |
|----------|--------------|
| Teacher-created assessment records under a framework category | Designing framework / categories (E31) |
| Marks + remarks per student (bulk + single) | Scheduled board exams as admin defs (E11 config) |
| Curriculum topic + LO coverage links | Live formula rollup UI |
| Attachments metadata | Full teacher portal redesign |
| Lock by Admin/HOD; edit until locked | Silent overwrite of marks |

**Hard rules**
- Every record **must** pin `assessment_framework_version_id` + `framework_category_id`.
- Marks are **append-only**: edits supersede prior rows (`is_current`); never UPDATE marks in place.
- After **lock**, teachers cannot enter/edit; corrections require unlock (Admin) or a dedicated correct action that still appends history.
- No person PII on mark rows — `student_profile_id` only.

---

## 2. Record fields

| Field | Source |
|-------|--------|
| Title, date, description | Teacher |
| Class, section, subject | Teacher (must match framework class/subject) |
| Assessment category | Framework category FK |
| Maximum marks | Teacher (defaults from category optional) |
| Curriculum topics / LOs covered | Optional M:N to E30 nodes |
| Students / marks / remarks | Mark rows |
| Attachments | Link/file metadata (E27 media_id optional) |

---

## 3. Schema

| Table | Role |
|-------|------|
| `assessment_records` | Evidence instance under a category |
| `assessment_record_marks` | Append-only per-student marks (`is_current`) |
| `assessment_record_topics` | Curriculum topic/subtopic links |
| `assessment_record_outcomes` | Learning outcome links |
| `assessment_record_attachments` | Attachments |
| `assessment_recording_audit_log` | Local audit |

**Record status:** `draft` \| `open` \| `locked`  
Teachers edit while `draft`/`open` and unlocked. Admin/HOD set `locked`.

---

## 4. Versioning / history

| Artifact | Strategy |
|----------|----------|
| Mark entry/edit | **A** — new row; prior `is_current=false`, `superseded_at` set |
| Record metadata | **M** until lock; archive soft |
| Lock | **X** — freeze teacher writes |

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `assessment_recording.read` | Teacher+ |
| `assessment_recording.create` | Teacher+ |
| `assessment_recording.edit` | Teacher (own unlocked) / HOD |
| `assessment_recording.enter_marks` | Teacher+ |
| `assessment_recording.lock` | HOD / Admin |
| `assessment_recording.unlock` | Admin / Principal |

---

## 6. Module

```text
lib/assessment-recording/
  types.ts validation.ts codes.ts
  server-helpers.ts audit.ts
  records-actions.ts
  marks-actions.ts
  coverage-actions.ts
  attachments-actions.ts
  query-actions.ts
  index.ts
```

---

## 7. Placement

| Concern | Owner |
|---------|-------|
| Evaluation plan / category weightages | E31 |
| Teacher evidence under categories | **E32** |
| Legacy scheduled exams + `exam_results` | E11 ops (still valid; migrate consumers gradually) |
| Curriculum trees | E30 |
| Report cards | E20 (prefer E32 marks + E31 formulas later) |

---

## 8. Tests

`npx tsx scripts/smoke-assessment-recording-validation.ts` · `npx tsc --noEmit`

---

*MASTER §63.*
