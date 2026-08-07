# FeezypayERP — Student Achievement Engine (E35)

> **Phase:** 3 — Academic Recording Platform  
> **Created:** 2026-08-07  
> **Owner engine:** **E35 Student Achievement**  
> **Companions:** [`event-activity-engine.md`](event-activity-engine.md) · [`student-profile-engine.md`](student-profile-engine.md) · [`report-card-engine.md`](report-card-engine.md) · MASTER §67  
> **Module:** `lib/achievements/` · Migration `20260807500000_student_achievement_engine.sql`

---

## 1. Purpose

Every school activity becomes part of the student's **permanent profile**. Activities **originate from the Academic Calendar** (`calendar_events` / E17). Teachers record participation outcomes; E35 **projects** durable achievement rows that Student Profile, Report Cards, Timeline, and future AI **read by reference**.

| Rule | Meaning |
|------|---------|
| P1 | Origin = Academic Calendar for school activities (`calendar_event_id`) |
| P2 | Never duplicate event title/description/date as SoT — join `calendar_events` |
| P3 | At most one achievement per `event_participant_id` |
| P4 | Manual / external awards allowed without an event (`source=manual`) |
| P5 | Soft-archive only — no hard delete of profile history |
| P6 | AI summaries are a **queued stub** (no provider calls in v1) |

**Boundary:** E17 owns live event ops (staffing, RSVP, participant rows). E35 owns the **permanent achievement profile** projection + manual awards.

---

## 2. Teacher-recorded fields

| Field | Column / source |
|-------|-----------------|
| Participation | `participation_role` (+ event participant link) |
| Attendance | `attendance_status` |
| Role | `participation_role` |
| Award | `award_label` |
| Position | `position_label` |
| Certificate | `certificate_status` / `certificate_document_id` (E20 doc) |
| Points | `points` |
| Remarks | `remarks` |
| Photos | `photo_media_ids` (E27 refs) |
| Attachments | `attachment_media_ids` / legacy `evidence_media_ids` |

---

## 3. Consumers (read by reference)

| Surface | How |
|---------|-----|
| Student Profile | `loadAchievements` — live E35 rows (+ event join for title/dates) |
| Report Cards | E20 assemble reads `student_achievements` ids in `source_refs` |
| Timeline | `listStudentAchievementTimelineAction` |
| Future AI summaries | `student_achievement_ai_summaries` queue stub |

---

## 4. Schema

| Table | Role |
|-------|------|
| `student_achievements` (enriched) | Permanent profile rows |
| `student_achievement_ai_summaries` | FUTURE AI jobs |
| `student_achievement_audit_log` | Local audit |

**Sources:** `calendar_event` · `manual` · `competition` · `import`

---

## 5. AuthZ

| Key | Typical |
|-----|---------|
| `student_achievement.read` | Teacher+; student/parent (visibility) |
| `student_achievement.record` | Teacher+ |
| `student_achievement.archive` | Admin / HOD |

---

## 6. API

| Action | Notes |
|--------|-------|
| `recordAchievementFromEventAction` | Upsert from `event_participant_id` (idempotent) |
| `recordManualAchievementAction` | External / non-calendar award |
| `syncAchievementsFromEventAction` | Bulk project all participants for an event |
| `updateAchievementOutcomesAction` | Update outcome fields (not event SoT) |
| `archiveStudentAchievementAction` | Soft-archive |
| `listStudentAchievementsAction` | Filters |
| `listStudentAchievementTimelineAction` | Profile timeline |
| `queueAchievementAiSummaryAction` | FUTURE stub |
| `listAchievementAiSummariesAction` / audit | Queries |

E17 `upsertEventParticipantAction` auto-syncs an achievement projection after successful upsert.

---

## 7. Tests

`npx tsx scripts/smoke-student-achievement-validation.ts`

---

*MASTER §67.*
