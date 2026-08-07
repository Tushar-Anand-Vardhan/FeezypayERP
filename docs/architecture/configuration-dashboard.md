# Configuration Dashboard

**Status:** `SHIPPED` (2026-08-07) — backend aggregator + minimal command-centre UI  
**Surface:** `/dashboard/configuration`  
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
| Links | Deep link to module UI or onboarding / in-page anchor |

## Catalog

Defined in `lib/config-dashboard/catalog.ts`. Includes branding, calendar, structure, subjects, grading scales, houses/clubs, departments, timetable, assessment, report cards, policies, communications, editing framework.

## Backend

- `buildConfigurationDashboard(supabase, schoolId)` — row counts + heuristics (`lib/config-dashboard/health.ts`)
- `getConfigurationDashboardAction()` — authenticated wrapper

No new tables. Read-only against existing config engines.

## UI

Minimal list on `/dashboard/configuration`. Nav: **Configuration** in `AppHeader`.

## Placement

Does **not** own configuration data. Engines remain the write path; this module only observes and links.
