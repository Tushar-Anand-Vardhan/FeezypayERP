# Event & Activity Engine (E17)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. Media bytes `NOT BUILT` (uuid[] refs only).  
> **Module:** `lib/events/**`  
> **Migration:** `supabase/migrations/20260807280000_event_activity_engine.sql`  
> **Origin:** Every activity is a `calendar_events` row (Academic Calendar / E17). Holidays stay E08.  
> **Companions:** [`academic-calendar-engine.md`](academic-calendar-engine.md) · [`daily-workflows.md`](../operations/daily-workflows.md) · MASTER §47

---

## 1. Purpose

Own **school occasions and activities** that always start on the academic calendar. Record staffing, participation, attendance, awards, positions, certificates, remarks, and media **refs**. Student Profile shows participation by **joining** `event_participants` → `calendar_events` — never dump event bodies onto students.

| Rule | Meaning |
|------|---------|
| P1 | Origin = `calendar_events` only (create via engine or existing calendar APIs) |
| P2 | No event title/description/date copies as SoT on student rows |
| P3 | House/club activities require `house_id` / `club_id` |
| P4 | Certificates issue via E20 `student_issued_documents` linked to event + participant |
| P5 | Attachments/photos are E27 media id arrays until Media engine ships |

---

## 2. Activity categories

`sports` · `competition` · `assembly` · `trip` · `workshop` · `club_activity` · `house_activity` · `cultural`  
(+ calendar leftovers: `ptm`, `teacher_meeting`, `annual_day`, `custom`)

---

## 3. Tables

| Table | Role |
|-------|------|
| `calendar_events` (enriched) | Origin + house/club/photos/certificate flag |
| `event_staff_assignments` | Teachers in charge / coaches / judges |
| `event_participants` (enriched) | RSVP, attendance, awards, positions, certificates, remarks, media refs |
| `competition_participations` | Projection for competition category (still FK to event) |
| `club_event_links` | Club ↔ event link when club activity created |
| `event_activity_audit_log` | Append-only audit |

---

## 4. Per-event capabilities

| Capability | Implementation |
|------------|----------------|
| Participants | `event_participants` |
| Teachers in charge | `event_staff_assignments` |
| Attendance | `attendance_status` on participant |
| Awards / positions | `award_label` / `position_label` |
| Certificates | `issueEventCertificateAction` → E20 doc |
| Remarks | `remarks` / staff `remarks` |
| Attachments / photos | `attachment_media_ids` / `photo_media_ids` (event + participant) |

---

## 5. API

| Action | Notes |
|--------|-------|
| `createActivityEventAction` | Inserts `calendar_events` (+ club link) |
| `updateActivityEventMetaAction` | House/club/media/certificate flags |
| `upsertEventStaffAssignmentAction` / archive | Teachers in charge |
| `upsertEventParticipantAction` / bulk / archive | Participation |
| `issueEventCertificateAction` | Certificate document |
| `listActivityEventsAction` / `getActivityEventDetailAction` | Queries |
| `listStudentEventParticipationsAction` | Profile-friendly join |
| `listEventActivityAuditAction` | Audit |

Calendar CRUD/approval remains `lib/calendar/events-actions.ts`.

---

## 6. Placement

- WF-ADM-07 / WF-PER-10 / WF-PER-11 / WF-PAR-07 / WF-STU-09  
- Student Profile `events` + `competitions` modules read by reference  

---

## 7. Tests

`npx tsx scripts/smoke-event-activity-validation.ts`
