# FeezypayERP — Timetable Configuration Engine (E10)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E10 Timetable**  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md)

---

## 1. Scope

| Supported | Future (stubs) |
|-----------|----------------|
| Periods (+ lock, break, archive) | Room allocation UI |
| Weekly schedule slots | Substitute workflow UI |
| Cycle days | |
| Alternate / exam / special grids | |
| Teacher allocation (employment FK) | |
| Section allocation | |
| Teacher & section availability | |
| Period / slot locking | |
| Conflict detection (pure + enforced on upsert) | |

**Hard rules**
- Eligibility stays E05 (`employment_subjects`); schedule map is E10.
- Conflict validation **blocks** engine upserts (teacher double-book, section double-book, unavailable, locked, break period, room double-book when room set).

---

## 2. Schema

`supabase/migrations/20260807170000_timetable_configuration_engine.sql`

| Table | Purpose |
|-------|---------|
| `timetable_grids` | primary / alternate / exam / special |
| `timetable_cycle_days` | Day labels + weekday mapping |
| `period_definitions` enrich | name, is_break, is_locked, archive |
| `timetable_slots` | Section × period × cycle day; optional `room_id`, locks, archive |
| `teacher_availability` | free/busy blocks |
| `section_availability` | free/busy blocks |
| `rooms` | FUTURE room catalog (optional slot FK) |

---

## 3. Module

```text
lib/timetable/
  types.ts
  validation.ts          # timesOverlap, detectSlotConflicts, …
  server-helpers.ts
  periods-actions.ts
  grids-actions.ts
  slots-actions.ts
  availability-actions.ts
```

Onboarding wipe-rewrite (`saveTimetableAction`) still works; prefer engine APIs for ongoing edits.

Onboarding UI builds a shared **day structure** (custom period name, start/end, educational yes/no) then a per-section grid/CSV. Teacher may be empty on any slot (typical for breaks). Headers: `class,section,day,period,subject,teacher`. `period` is the custom name or number.

---

## 4. Tests

`npx tsx scripts/smoke-timetable-validation.ts`

---

*MASTER §33.*
