# FeezypayERP — Academic Calendar Engine (E08 + E17 surface)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engines:** **E08 Calendar** (years, terms, working days, holidays) · **E17 Event** (`calendar_events`)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`versioning.md`](versioning.md)

---

## 1. Boundary (locked)

| Concern | Owner | Table |
|---------|-------|-------|
| Academic year lifecycle | E08 | `academic_years` |
| Terms | E08 | `terms` |
| Working week pattern | E08 | `school_working_day_patterns` |
| Non-instructional days | E08 | `holidays` |
| Occasions (PTM, sports, trips…) | E17 | `calendar_events` |
| Bell periods / slots | E10 | `periods` / `timetable_slots` (not this module) |

**Rule:** Holiday ≠ CalendarEvent ≠ TimetableSlot.

---

## 2. Schema (migration)

`supabase/migrations/20260807130000_academic_calendar_engine.sql`

### Enriched

- `academic_years`: `start_date`, `end_date`, `status` (`draft|active|closed`), `archived_at`, `updated_at`; DELETE revoked for `authenticated`
- `terms`: `archived_at`, `updated_at`

### New

- `school_working_day_patterns` — school default (`academic_year_id` null) or per-year override
- `holidays` — archive-only (no DELETE grant)
- `calendar_events` — categories, visibility, audience JSON, approval_status, future stubs (`recurrence_rule`, `attachment_media_ids`, `notify_on_publish`, `attendance_required`)

### Event fields (v1)

`title`, `description`, `category`, `starts_at`, `ends_at`, `is_all_day`, `location`, `visibility`, `audience`, `academic_year_id`, `term_id`, `created_by`, `approval_status`

### Categories

`ptm` · `competition` · `sports` · `trip` · `assembly` · `workshop` · `teacher_meeting` · `annual_day` · `club_activity` · `house_activity` · `cultural` · `custom`

Activity ops (participants, staff, awards, certificates): [`event-activity-engine.md`](event-activity-engine.md) · MASTER §47.

### Future (columns present, behavior deferred)

Recurring events · attachments · notifications on publish · event attendance · AI summaries

---

## 3. Module layout

```text
lib/calendar/
  types.ts
  validation.ts
  years-actions.ts
  terms-actions.ts
  working-days-actions.ts
  holidays-actions.ts
  events-actions.ts
```

Admin UI: `/dashboard/calendar` — week/month grid (Wave 5) + year/term/holiday/event forms.

---

## 4. Mutation rules

| Object | Create | Edit | Archive | Hard delete |
|--------|--------|------|---------|-------------|
| Academic year | ✓ | activate/close | ✓ | Denied (DB) |
| Term | ✓ | ✓ | ✓ | Onboarding may still replace-set; calendar API archives |
| Working days | Upsert | Upsert | — | Allowed (pattern row) |
| Holiday | ✓ | ✓ | ✓ | Denied (DB) |
| Calendar event | ✓ | ✓ + approval | ✓ | Denied (DB) |

---

## 5. Tests

`npx tsx scripts/smoke-calendar-validation.ts` — pure validation (no DB).

---

*Implementation notes live in MASTER §29.*
