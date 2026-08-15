# Configuration Dashboard

**Status:** `SHIPPED` (2026-08-07) — backend aggregator + command-centre UI  
**Wave 3:** Config hub tabs `SHIPPED` (2026-08-12)  
**Surface:** `/dashboard/configuration` (`?tab=` panels + outbound admin links)  
**Module:** `lib/config-dashboard/**`

## Purpose

School setup **command centre**. Aggregates every Phase 1 configuration module and surfaces:

| Signal | Meaning |
|--------|---------|
| Completion status | `complete` · `partial` · `missing` · `not_applicable` · `backend_only` |
| Warnings | Soft gaps (e.g. no holidays, unpublished templates) |
| Missing configuration | Hard gaps required for a usable school year |
| Dependency errors | Cross-module breakage (e.g. slots → archived subjects) |
| Health checks | Informational / readiness notes |
| Links | Deep link to hub tabs or dedicated admin UIs (not `/onboarding/*` after go-live) |

## Catalog

Defined in `lib/config-dashboard/catalog.ts`. Includes branding, calendar, structure, subjects, grading scales, houses/clubs, departments, timetable, assessment, report cards, policies, communications, editing framework.

## Config hub (Wave 3)

Tabs in `lib/config-dashboard/hub-tabs.ts` mirror onboarding steps:

| Tab | Behaviour |
|-----|-----------|
| Health | Existing module readiness list |
| School identity | Edit name, **school code**, board, address (`schools.code`) |
| Terms | Edit term dates via `updateTermAction`; **count locked** after onboarding / when events reference terms |
| Classes & sections | Completeness checklist only (no wipe/rebuild writers) |
| Subjects / houses / staff / students / timetable / exams / grading / departments | Outbound links to existing admin pages |

Term guards: `lib/calendar/term-edit-guards.ts` (wired into `terms-actions`).

## Backend

- `buildConfigurationDashboard(supabase, schoolId)` — row counts + heuristics (`lib/config-dashboard/health.ts`); called from `/dashboard/configuration` page

No new tables beyond optional `schools.code` (Wave 3 migration). Health remains read-only against existing config engines.

## UI

`/dashboard/configuration` — `ConfigHubClient` with `?tab=` navigation. Nav: **Configuration** in the dashboard sidebar (Configuration group).

## Placement

Does **not** own configuration data. Engines remain the write path; this module observes, links, and hosts thin edit panels that call owning actions.
