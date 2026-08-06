# FeezypayERP — Phase 0.5 Architecture Review

> **Role:** Chief Software Architect review  
> **Date:** 2026-08-06  
> **Status:** **Phase 0.5 COMPLETE** (design-only). No application code in this deliverable.  
> **Scope:** All docs under `docs/architecture/` + MASTER §§7, 12, 14, 17–25  
> **Verdict:** Boundaries and ownership are strong for a pre-build phase. **Do not start Fee, portals, or WhatsApp** until P0 seams below are design-locked for implementation.

---

## 1. Phase 0.5 deliverables (accepted)

| Doc | Contract |
|-----|----------|
| [`business-engines.md`](business-engines.md) | E01–E28 + ownership matrix |
| [`domain-model.md`](domain-model.md) | Major entities + ER |
| [`system-events.md`](system-events.md) | 67 named events |
| [`rbac.md`](rbac.md) | Personas × engines × actions |
| [`versioning.md`](versioning.md) | Config vs ops mutation strategies |
| [`audit-log.md`](audit-log.md) | E28 audit shape + retention |
| [`notification-engine.md`](notification-engine.md) | E18→E19 delivery |
| [`ai-architecture.md`](ai-architecture.md) | E23 assistive; never source of truth |
| This review | Weaknesses + prioritized improvements |

**Phase 0.5 is complete.** Next work is **Phase 1 — Implementation readiness** (close P0 design gaps, then code against contracts).

---

## 2. Shipped vs designed (gap map)

| Plane | Shipped / partial | Design-only |
|-------|-------------------|-------------|
| Tenancy, Identity, Workforce, Enrollment, Config, Calendar, Structure, Timetable, Assessment defs, Onboarding, Ingestion, Media | Mostly shipped | — |
| E03 RBAC runtime, Assessment results, Attendance/Conduct/Health, Fee/Payments, Event/Comms/Notify, Document/Reporting/Analytics/AI, Marketplace, Audit | — | Designed; not built |
| Event bus / outbox | Catalogue only | No runtime |
| Auth beyond school_admin | Schema-ready | F11 blocks invites |

---

## 3. Architectural weaknesses

| ID | Finding | Risk |
|----|---------|------|
| W1 | **E01↔E02 signup cycle** — `handle_new_user` always creates school + admin | Blocks invites; orphan tenants |
| W2 | **RLS membership ≠ target AuthZ** — RLS still `profiles`-only | Portal leak if expanded without membership helper |
| W3 | **Column-level ownership** (`schools.*`, medical cols) without API façades | Drift when coding resumes |
| W4 | **Dual teaching maps** — EmploymentSubject vs TeachingAssignment vs TimetableSlot | Triple “who teaches what” |
| W5 | **Events designed, no outbox** | Cross-engine calls will entrench |
| W6 | **No first-class Command catalogue** | Promotion / fee fine / AI accept underspecified |
| W7 | **E25 onboarding as fat orchestrator** | Rollover will amplify coupling |
| W8 | **Event naming drift** — short names in engines §12 vs canonical catalogue | Wrong contracts at implement time |
| W9 | **`profiles` vs Person-linked admin** unresolved for multi-admin future | Dual membership truths |
| W10 | **HouseMembership owner / shape** still approximate (`admission.house_id`) | Mid-year house moves painful |

---

## 4. Missing Business Engines

**No new Exx required** for the current product vision. E01–E28 cover the map.

**Depth gaps (not new engines):**

| Gap | Action |
|-----|--------|
| Fee Engine deep-dive | Design ledger, plans, payers, concessions before code |
| Integration / webhook boundary | Name submodule under E16/E19 to contain service-role |
| Platform SaaS billing vs school fees | Keep under E01; name clearly to avoid Fee confusion |
| Transport / Leave / Boarding | Correctly deferred satellites |

Do **not** add engines for digests, SMS, or “reminders” — those stay E18/E19.

---

## 5. Scalability issues

| Area | Issue |
|------|--------|
| Multi-tenant | Need `membership_schools(auth.uid())` + school switcher for multi-role |
| Events | Hot-school fan-out (attendance mark-all) needs school-scoped queues + batch envelopes |
| Notifications | Overdue / year-start spikes need priority queues + dedupe before WhatsApp |
| AI | Need E22 marts before insights; enforce no service-role “read all” |
| Year rollover | §8 sketch only — without playbook, schools mutate closed years |
| Ingestion | 50k-row year-start + blocking CSV needs async staging (E26) |
| Identity merge | Cross-school match/merge tooling undesigned |

---

## 6. Normalization issues

- `schools` one row / four owners — OK logically; need façades  
- Health columns on `student_profiles` — fragile for compartmented RLS  
- House on admission vs HouseMembership entity  
- ClubMembership missing while clubs catalog shipped  
- ClassSubject year-scoping ambiguous  
- Version tables (grading, fee plan, templates, timetable grid) required by versioning but not in schema  
- Invoice payer / concession / scholarship not first-class  
- Auth email vs `persons.email` sync not operationalized  

---

## 7. Security concerns

| ID | Concern | Pri |
|----|---------|-----|
| S1 | F11 invite creates new school | P0 |
| S2 | RLS admin-only vs future portals | P0 |
| S3 | Service role without runtime audit | P0 before invites/pay |
| S4 | Aadhaar / PII in logs, AI, events | P1 |
| S5 | Health compartment on shared table | P1 |
| S6 | AI egress / DLP not built | P1 before AI GA |
| S7 | Payment webhook signature + ledger ownership | P0 with Fee |
| S8 | Marketplace over-exposure | P2 |
| S9 | Super Admin impersonation tables missing | P2 |

---

## 8. Permission issues

- Runtime still **RBAC-0** (school_admin via `profiles`)  
- F11 before RBAC-1  
- Permission key catalog empty (keys sketched only)  
- Accountant persona needed before Fee MVP or all money ops concentrate on admin  
- Class-teacher ABAC needs reliable employment↔section wiring  
- Multi-role session switcher undesigned beyond phase label  
- Year unlock permission critical before rollover tooling  
- Dual `has_permission` in SQL vs app risks divergence  

---

## 9. Future migration risks

| Risk | Later pain |
|------|------------|
| Ship invites before F11 | Orphan schools + cleanup |
| Dual admin membership forever | AuthZ bugs |
| End employment without timetable supersede | Broken published grids |
| Fee/Docs/Attendance without versioning primitives | Irreversible bad history |
| Direct module→WhatsApp calls | Untangle cost |
| Mutable exam defs + late append-only results | Audit/compliance failure |
| Destructive CSV replace | Wipes employment/admission history |

---

## 10. Feature overlap (watch list)

| Pair | Correct split | Residual risk |
|------|---------------|---------------|
| E18 ↔ E19 | Content vs delivery | In-app inbox ownership fuzzy |
| E08 ↔ E17 | Holiday vs occasion | Misfiled sports days |
| E05 ↔ E10 | Eligibility vs schedule | Three teaching tables |
| E07 ↔ E15 | Catalog vs fee heads | Fee heads in Config UI |
| E12 ↔ E15 | Absence → fine | Attendance inventing invoices |
| E11 ↔ E20 | Marks vs report card | AI remarks storage blur |
| E02 ↔ E19 | Auth mailer vs app mail | Dual pipes |
| E21 ↔ E22 | Ops report vs marts | “Dashboard” collision |

---

## 11. Missing entities (add before adjacent GA)

**Critical planned:** Permission/RolePermission, GradingScale(+V), AssessmentResult, FeeHead/FeePlan(+V)/Invoice/LedgerEntry, Payment, TimetableGrid version, MessageTemplate(+V), CommunicationConsent, DeliveryRequest/Attempt, DocumentTemplate(+V)/IssuedDocument, AuditEntry, Holiday, PromotionRule, HouseMembership, ClubMembership, MediaAsset, ImportJob, AISuggestion.

**Consider adding to domain model before Fee GA:** FeeAccount, PayerAssignment, Concession/Scholarship, OutboxMessage, IdempotencyRecord, DevicePushToken, InviteToken.

---

## 12. Missing events / contracts

- First-class **Command catalogue** (promotion batch, fee.generate_invoices, fee.apply_fine, …)  
- `fee.fine.*` / concession events  
- `enrollment.placement.section_changed`  
- `identity.person.merged`  
- `tenant.school.reactivated`  
- `workforce.teacher.invite_revoked`  
- `communication.consent.updated`  
- `payment.webhook.received` (sanitized)  
- `calendar.academic_year.unlocked`  
- `structure.capacity.breached`  
- Batch/summary envelopes for mark-all / CSV  
- Align engines §12 short names → canonical `system-events.md` names  

---

## 13. Prioritized architectural improvements (before / as implementation begins)

### P0 — Blockers (do before Fee, portals, WhatsApp)

| # | Improvement | Why |
|---|-------------|-----|
| 1 | **F11 signup-trigger split** (`create_school` vs invite) | Unblocks invites; stops orphan tenants |
| 2 | **Membership RLS model** — profiles ∪ employments ∪ admissions ∪ parent links | Tenant isolation for non-admin personas |
| 3 | **Transactional outbox + event envelope** (start in-process mediator) | Prevents tight coupling; enables E15↔E16 |
| 4 | **Fee Engine deep-dive** (plan versions, invoice, ledger A/C, payer, pin amounts) | Brand core; wrong truth is expensive |
| 5 | **Year-rollover playbook** (close/activate/clone/promote/lock) | Prevents closed-year mutation |

### P1 — First implementation wave dependencies

| # | Improvement | Why |
|---|-------------|-----|
| 6 | **RBAC-1 invite path** end-to-end (invited → auth bind → profile complete → active) | Schema-ready; product gap |
| 7 | **E03 permission keys + server-action guards** (admin + teacher subset) | Stop hard-coded persona checks |
| 8 | **Resolve E05 vs E10 teaching maps** (eligibility vs slots; subordinate assignments) | Single schedule truth |
| 9 | **Versioning primitives** before Fee/Docs/Attendance GA | Avoid D3–D9 class failures |
| 10 | **E28 AuditEntry** on service_role, money, year unlock | Compliance + forensics |
| 11 | **E18→E19 in-app pipe** only; ban provider SDKs in domain modules | Notification boundary |
| 12 | **SchoolAdminMembership strategy** (keep profiles bootstrap; Person-linked multi-admin) | Avoid permanent dual AuthZ |

### P2 — Hardening

| # | Improvement | Why |
|---|-------------|-----|
| 13 | **Column-owner façades** for `schools.*` and Health columns | Enforce ownership in review |
| 14 | **Command catalogue** alongside events | Clarify sync write paths |
| 15 | **AI readiness gates** — no AI GA until E22 marts + user-scoped tools + accept→command | Prevent shadow ERP |

---

## 14. Recommended sequence after Phase 0.5

```text
F11 → membership RLS → outbox/events
  → Fee + versioning deep-dive → year-rollover playbook
  → invite / RBAC-1 → audit on those paths
  → in-app notifications
  → Assessment results / Attendance / Payments channels
  → AI (last among these)
```

---

## 15. Declaration

**Phase 0.5 — Architecture is COMPLETE** as of 2026-08-06.

All planned architecture documents for this phase are accepted as **binding contracts**. Implementation must follow them and close **P0** items before commercial and portal features.

---

*End of Phase 0.5 architecture review. Companion: MASTER §26.*
