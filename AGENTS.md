<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project documentation

- Living technical master doc: [`docs/MASTER.md`](docs/MASTER.md) — auth, onboarding, schema, RBAC roadmap, test log. Update it whenever architecture or plans change.
- Business engines (Phase 0.5): [`docs/architecture/business-engines.md`](docs/architecture/business-engines.md)
- Domain model (Phase 0.5): [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md)
- System events (Phase 0.5): [`docs/architecture/system-events.md`](docs/architecture/system-events.md)
- RBAC (Phase 0.5): [`docs/architecture/rbac.md`](docs/architecture/rbac.md)
- Versioning (Phase 0.5): [`docs/architecture/versioning.md`](docs/architecture/versioning.md)
- Audit logging (Phase 0.5): [`docs/architecture/audit-log.md`](docs/architecture/audit-log.md)
- Notification Engine (Phase 0.5): [`docs/architecture/notification-engine.md`](docs/architecture/notification-engine.md)
- AI architecture (Phase 0.5): [`docs/architecture/ai-architecture.md`](docs/architecture/ai-architecture.md)
- Phase 0.5 review (COMPLETE): [`docs/architecture/phase-05-architecture-review.md`](docs/architecture/phase-05-architecture-review.md)
- Configuration Engine (Phase 1): [`docs/architecture/configuration-engine.md`](docs/architecture/configuration-engine.md) · `lib/config/`
- Assessment Configuration Engine (Phase 1): [`docs/architecture/assessment-configuration-engine.md`](docs/architecture/assessment-configuration-engine.md) · `lib/assessment/`
- Report Card Template Engine (Phase 1): [`docs/architecture/report-card-template-engine.md`](docs/architecture/report-card-template-engine.md) · `lib/report-cards/`
- School Policy Engine (Phase 1): [`docs/architecture/school-policy-engine.md`](docs/architecture/school-policy-engine.md) · `lib/policies/`
- Communication Configuration Engine (Phase 1): [`docs/architecture/communication-configuration-engine.md`](docs/architecture/communication-configuration-engine.md) · `lib/communications/`
- Configuration Editing Framework (Phase 1): [`docs/architecture/configuration-editing-framework.md`](docs/architecture/configuration-editing-framework.md) · `lib/editing/`
- Configuration Dashboard (Phase 1): [`docs/architecture/configuration-dashboard.md`](docs/architecture/configuration-dashboard.md) · `lib/config-dashboard/`
- Phase 1 implementation audit: [`docs/architecture/phase-1-implementation-audit.md`](docs/architecture/phase-1-implementation-audit.md) — **production gate NOT PASSED**
- Phase 2 daily workflows: [`docs/operations/daily-workflows.md`](docs/operations/daily-workflows.md) — cite workflow IDs before ops code
- Phase 2 operations audit: [`docs/operations/phase2-audit.md`](docs/operations/phase2-audit.md) — **production gate NOT PASSED**; Phase 2 **not COMPLETE**
- Authentication Platform (Phase 2.5): [`docs/architecture/authentication-platform.md`](docs/architecture/authentication-platform.md) · `lib/auth/` · `lib/supabase/admin.ts` — AuthN (F11, invites, membership)
- Authorization Platform (Phase 2.6 / E03): [`docs/architecture/authorization-platform.md`](docs/architecture/authorization-platform.md) · [`rbac.md`](docs/architecture/rbac.md) · `lib/authz/` — `requirePermission` / `<Can>`; never hardcode persona for AuthZ
- Membership Engine (Phase 2.7 / E29): [`docs/architecture/membership-engine.md`](docs/architecture/membership-engine.md) · `lib/membership/` — person↔school index, preferences, switch-school; sync on employment/admission/parent writers
- Notification Operations (Phase 2.8): [`docs/architecture/notification-operations.md`](docs/architecture/notification-operations.md) · `lib/domain-events/` · `lib/notify-orchestration/` · `lib/notifications/` — emit → orchestrate → deliver; domains never call providers
- Teacher Portal (Phase 2.9): [`docs/architecture/teacher-portal.md`](docs/architecture/teacher-portal.md) · `lib/teacher-portal/` · `components/teacher-portal/` · `/dashboard/teacher/*` — thin permission-gated UI over Phase 2 engines
- Student Portal (Phase 2.10): [`docs/architecture/student-portal.md`](docs/architecture/student-portal.md) · `lib/student-portal/` · `components/student-portal/` · `/dashboard/student/*` — RO self-scoped UI over student-profile + engines
- Parent Portal (Wave 6 / F10): [`docs/architecture/parent-portal.md`](docs/architecture/parent-portal.md) · `lib/parent-portal/` · `/dashboard/parent/*` — RO linked-child UI
- Curriculum Engine (Phase 3 / E30): [`docs/architecture/curriculum-engine.md`](docs/architecture/curriculum-engine.md) · `lib/curriculum/` — year/board/grade/subject packs, publish versions, teacher progress
- Assessment Framework Engine (Phase 3 / E31): [`docs/architecture/assessment-framework-engine.md`](docs/architecture/assessment-framework-engine.md) · `lib/assessment-framework/` — year×class×subject evaluation plans, categories, formulas, version/clone
- Assessment Recording Engine (Phase 3 / E32): [`docs/architecture/assessment-recording-engine.md`](docs/architecture/assessment-recording-engine.md) · `lib/assessment-recording/` — teacher evidence under categories; append-only marks; lock
- Grade Calculation Engine (Phase 3 / E33): [`docs/architecture/grade-calculation-engine.md`](docs/architecture/grade-calculation-engine.md) · `lib/grade-calculation/` — deterministic finals from framework + records; auditable runs
- Report Card Engine (Phase 3 / E20): [`docs/architecture/report-card-engine.md`](docs/architecture/report-card-engine.md) · `lib/report-cards/` — template designer + assemble from sources; draft/published/locked
- Student Observation Engine (Phase 3 / E34): [`docs/architecture/student-observation-engine.md`](docs/architecture/student-observation-engine.md) · `lib/observations/` — append-only structured observations; filters; AI summary stub
- Student Achievement Engine (Phase 3 / E35): [`docs/architecture/student-achievement-engine.md`](docs/architecture/student-achievement-engine.md) · `lib/achievements/` — permanent profile from calendar activities; timeline + AI stub
- Student Profile Engine (Phase 2): [`docs/architecture/student-profile-engine.md`](docs/architecture/student-profile-engine.md) · `lib/student-profile/`
- Teacher Workspace (Phase 2): [`docs/architecture/teacher-workspace.md`](docs/architecture/teacher-workspace.md) · `lib/teacher-workspace/` · `/dashboard/teacher`
- Attendance Engine (Phase 2): [`docs/architecture/attendance-engine.md`](docs/architecture/attendance-engine.md) · `lib/attendance/`
- Assessment Operations Engine (Phase 2): [`docs/architecture/assessment-operations-engine.md`](docs/architecture/assessment-operations-engine.md) · `lib/assessment/` (ops)
- Report Card Engine (Phase 2): [`docs/architecture/report-card-engine.md`](docs/architecture/report-card-engine.md) · `lib/report-cards/` (issue)
- Event & Activity Engine (Phase 2): [`docs/architecture/event-activity-engine.md`](docs/architecture/event-activity-engine.md) · `lib/events/`
- Behaviour Engine (Phase 2): [`docs/architecture/behaviour-engine.md`](docs/architecture/behaviour-engine.md) · `lib/behaviour/`
- Communication Operations (Phase 2): [`docs/architecture/communication-operations-engine.md`](docs/architecture/communication-operations-engine.md) · `lib/communications/` · `lib/notifications/`
- Homework & Assignment Engine (Phase 2): [`docs/architecture/homework-assignment-engine.md`](docs/architecture/homework-assignment-engine.md) · `lib/homework/`
- Student Analytics Engine (Phase 2): [`docs/architecture/student-analytics-engine.md`](docs/architecture/student-analytics-engine.md) · `lib/student-analytics/`
- Teacher Analytics Engine (Phase 2): [`docs/architecture/teacher-analytics-engine.md`](docs/architecture/teacher-analytics-engine.md) · `lib/teacher-analytics/`
- Principal Dashboard (Phase 2): [`docs/architecture/principal-dashboard.md`](docs/architecture/principal-dashboard.md) · `lib/principal-dashboard/` · `/dashboard/principal`
- Deferred identity follow-ups: [`docs/deferred-identity-followups.md`](docs/deferred-identity-followups.md)
