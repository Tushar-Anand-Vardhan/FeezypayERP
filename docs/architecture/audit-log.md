# FeezypayERP — Audit Logging Architecture

> **Phase:** 0.5 — Architecture (design-only)  
> **Created:** 2026-08-06  
> **Status:** Canonical audit contract — **not yet implemented** (`AuditEntry` planned; E28 `NOT BUILT`)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`system-events.md`](system-events.md) · [`rbac.md`](rbac.md) · [`versioning.md`](versioning.md)  
> **Owner engine:** **E28 Audit** — append-only; never business source of truth  
> **Rule:** Every important mutating action in the ERP must be auditable.

---

## 1. Goals

1. Answer *who did what, to which entity, in which school, when, with what before/after* for compliance and forensics.  
2. Cover human, system, AI-accepted, and service-role actions.  
3. Avoid becoming a second OLTP store — ids + field diffs, not full denormalized PII dumps.  
4. Feed future Analytics / SIEM without coupling product engines to log sinks.  
5. Align with versioning (immutable audit rows) and RBAC (who may **read** audits).

---

## 2. Principles

| Principle | Detail |
|-----------|--------|
| **Append-only** | No UPDATE/DELETE of audit rows in application paths; corrections = new audit of the correction |
| **Not source of truth** | Reconstruct facts from owning engines; audit explains *change*, not current state |
| **Defense in depth** | Prefer write audit in same unit-of-work / outbox as the mutation; never “log later if convenient” for critical severity |
| **Events ≠ audit** | Domain events (`enrollment.student.admitted`) notify engines; audit records actor + diffs. Often both fire; audit may reference `event_id` |
| **Minimize secrets** | Never log raw Aadhaar, passwords, payment provider secrets, full card data, or unrestricted medical narratives |
| **Tenant-scoped** | Every school action carries `school_id`; platform actions use null school + platform scope |
| **Actor always set** | User, system job, webhook, or AI-accept-as-human — never anonymous for mutating writes |

---

## 3. Audit record (canonical shape)

Logical `AuditEntry` (E28). Physical table design later; fields are the contract.

### 3.1 Required fields

| Field | Type | Purpose |
|-------|------|---------|
| `audit_id` | uuid | Primary key; idempotency with outbox |
| `occurred_at` | timestamptz | When the action committed (producer clock) |
| `recorded_at` | timestamptz | When E28 persisted the row (may lag if async) |
| `school_id` | uuid \| null | Tenant; null only for platform / cross-tenant Super Admin ops |
| `actor` | object | Who performed it — see §3.2 |
| `action` | string | Verb from controlled vocabulary — see §4 |
| `entity_type` | string | Domain entity name (`StudentAdmission`, `Assessment`, …) |
| `entity_id` | uuid \| string | Primary affected entity id |
| `severity` | enum | `debug` \| `info` \| `notice` \| `warning` \| `critical` — see §6 |
| `outcome` | enum | `succeeded` \| `failed` \| `denied` |
| `correlation_id` | uuid | Ties request / wizard / job / event chain |
| `causation_id` | uuid \| null | Prior audit or `event_id` that caused this |

### 3.2 Actor (`who performed it`)

| Field | Notes |
|-------|-------|
| `actor_type` | `user` \| `system` \| `webhook` \| `ai` \| `service_role` |
| `auth_user_id` | Supabase `auth.uid()` when human/session |
| `person_id` | Resolved Person when bound |
| `persona` | Active RBAC persona at time of action (`school_admin`, `teacher`, …) |
| `employment_id` / `admission_id` | School link context when relevant |
| `service_name` | Job or adapter name (`payments.webhook`, `ingestion.worker`) |
| `impersonator_auth_user_id` | Super Admin break-glass; always set when impersonating |
| `ip` / `user_agent` | Optional; hash or truncate per privacy policy |

**AI rule:** When a human accepts an `AISuggestion`, actor is the **human** (`actor_type=user`); store `ai_suggestion_id` in metadata. Propose-only AI actions may log `actor_type=ai` at `info` without OLTP mutation.

### 3.3 Change payload (old / new values)

| Field | Purpose |
|-------|---------|
| `old_values` | JSON object of **changed fields only** before mutation (null on create) |
| `new_values` | JSON object of **changed fields only** after mutation (null on pure delete/archive) |
| `changed_fields` | string[] — explicit list for indexing / UI |
| `diff_hash` | Optional hash of canonicalized diff for integrity checks |

**Rules for old/new:**

1. Log **ids and enums**, not entire row blobs.  
2. Redact: `aadhaar_*`, password hashes, raw tokens, payment PANs, unrestricted `medical_notes` body (log “medical_notes_updated: true” only unless Health ACL + legal hold).  
3. For versioning strategy **V**, log `old_version_id` → `new_version_id` rather than full template body.  
4. For **C** compensating writes, log `corrects_entity_id` / `corrects_audit_id`.  
5. Failed / denied attempts: log intended `action` + reason; `old_values`/`new_values` may be empty.

### 3.4 Context (optional but recommended)

| Field | Purpose |
|-------|---------|
| `engine_id` | Owning engine of the write (`E06`, …) |
| `permission_key` | AuthZ key checked (`enrollment.admission.create`) |
| `event_name` / `event_id` | Domain event emitted alongside |
| `mutation_strategy` | Versioning code `M/R/V/E/A/C/X/K` |
| `request_path` / `action_name` | Server action or route |
| `batch_id` | CSV/ingestion job linking many audits |
| `metadata` | Small non-PII bag (row counts, reason codes) |

### 3.5 Affected entity

Primary: `entity_type` + `entity_id`.

Secondary subjects (optional array `related_entities[]`): e.g. admitting a student also touches Person, Placement, ParentLink — primary = Admission; related = Person, Placement.

UI “entity timeline” queries by primary **or** related id.

---

## 4. What should be logged

### 4.1 Always (severity ≥ `notice`)

| Category | Examples |
|----------|----------|
| **AuthN / Access** | Sign-up, login success/failure (no password), logout, password reset request, invite send, auth bind, account disable |
| **AuthZ** | Role/permission grant/revoke, custom role publish, deny on critical resources (optional sample of denies) |
| **Tenancy** | School create/suspend/archive, onboarding complete, year activate/close, unlock closed year |
| **Identity** | Person match/merge, profile create, sensitive field change (email, aadhaar hash set), profile complete |
| **Workforce / Enrollment** | Invite, employment create/end, admission create/withdraw/transfer, placement create/complete, parent link |
| **Config structural** | Subject/class/section/department/house archive or semantic change; grading scale version publish; period/grid publish |
| **Assessment** | Exam create/publish, results publish/lock, result corrections |
| **Attendance / Conduct / Health** | Mark attendance (batch summary OK), threshold breach handling, incident create/approve, health field updates (redacted) |
| **Fee / Payments** | Invoice create/void, waiver approve, ledger post/compensate, payment succeed/fail/refund, reconciliation |
| **Documents** | Template version publish, document/report card issue/reissue |
| **Communication** | Announcement publish, message ready, notification sent/bounced (delivery ids, not full body by default) |
| **Ingestion** | Job commit/fail, row-block reasons summary |
| **Media** | Upload/delete of logos, photos, issued PDFs |
| **Break-glass** | Super Admin impersonation start/end, service-role use outside webhooks |
| **AI accept** | Suggestion accepted → which command ran |

### 4.2 Usually (`info`)

| Category | Notes |
|----------|-------|
| Onboarding step complete | Soft; useful for funnel |
| Timetable draft edits | Before publish; may sample or batch |
| Lesson plan share | |
| Read of highly sensitive health/fee detail | Optional “access audit” for compliance schools |
| Reporting job requested/completed | |

### 4.3 Rarely / never as full audit

| Category | Prefer instead |
|----------|----------------|
| High-frequency UI navigation | Product analytics (E22), not E28 |
| Every SELECT on class list | — |
| Unchanged autosave no-ops | Skip if no field diff |
| Full message body / PDF bytes | Store in Media; audit references `media_id` |
| Raw webhook payloads with secrets | Store sanitized provider event id |

### 4.4 Failed and denied actions

Log **critical/warning** attempts that matter for security:

- Auth login failure (rate-limit friendly aggregation allowed)  
- Permission denied on fee void, year unlock, role grant, payment refund  
- Ingestion validation block (summary)  

Do not flood audit with every RBAC deny on ordinary UI probes — sample or elevate only sensitive keys.

---

## 5. Severity model

| Severity | Use when | Retention tier (see §7) | Alerting |
|----------|----------|-------------------------|----------|
| `debug` | Dev-only verbose; normally off in prod | Short / off | No |
| `info` | Routine successful mutations | Standard | No |
| `notice` | Business-significant success (admit, publish exam, pay) | Standard+ | Dashboard |
| `warning` | Denied sensitive action, partial batch failure, bounce | Extended | Ops optional |
| `critical` | Money movement anomaly, year unlock, impersonation, role escalate, data purge attempt, security incident | Legal / max | Immediate |

Severity is set by the **producing engine** using this table; E28 may upgrade (never downgrade) based on action vocabulary.

---

## 6. School & multi-tenancy

| Case | `school_id` |
|------|-------------|
| Normal school action | Required — actor’s active school |
| Parent/teacher multi-school | School of the resource mutated |
| Platform Super Admin on one school | That `school_id` + impersonation fields |
| Platform catalog / Super Admin global | `null` + `scope=platform` in metadata |
| Cross-school Person edit | School of the membership that authorized the edit; if global identity-only, `null` + strict SA policy |

RLS: readers see audits where `school_id IN membership_schools` **and** `audit.entry.read` (Adm/Pri/VP/SA per RBAC). Students/parents: **no** general audit UI.

---

## 7. Retention policy

| Tier | Severity / class | Hot (queryable in app) | Warm (exportable archive) | Cold / delete |
|------|------------------|------------------------|---------------------------|---------------|
| **T0 Debug** | `debug` | 7–30 days | — | Purge |
| **T1 Standard** | `info`, most `notice` | **24 months** (default) | + 36 months object storage | Purge or anonymize after warm |
| **T2 Extended** | `warning`, AuthZ grants, config publish | **5 years** | + 2 years | Per school policy |
| **T3 Financial / legal** | Payments, ledger, invoices, issued docs, year close | **7–10 years** (jurisdiction) | Remainder of legal term | Legal hold blocks purge |
| **T4 Security** | Impersonation, service_role abuse, auth anomalies | **7 years** min | SIEM copy | Legal hold |

**School overrides:** School Admin may request longer retention (config flag); cannot shorten below platform minimum for T3/T4.

**Legal hold:** Flag on `school_id` or `entity_id` prevents purge/anonymize until cleared by Super Admin.

**Anonymization:** Replace actor display fields; keep ids hashed if regulations require; never silently drop financial T3 rows.

**Export:** School-scoped JSON/CSV for compliance officer; hashed integrity manifest.

---

## 8. Write path (design)

```text
  Domain engine mutation (authorized)
        │
        ├─► OLTP write (owner engine)
        ├─► Domain event (system-events catalogue)
        └─► Audit intent ──► transactional outbox
                                  │
                                  ▼
                            E28 append AuditEntry
                                  │
                                  ▼
                         audit.entry.recorded (async)
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                 SIEM         Analytics      Retention worker
```

| Mode | When |
|------|------|
| **Sync drain** | `critical` / T3 money — outbox drained before success response when feasible |
| **Async** | `info`/`notice` bulk (attendance mark-all, CSV row fan-out → one batch audit + optional per-row) |

**Idempotency:** `(correlation_id, action, entity_id, diff_hash)` or outbox `audit_id` unique — retries must not duplicate.

**Service role:** Every use emits `critical` or `warning` audit with `service_name`.

---

## 9. Relationship to domain events

| Concern | Domain event | Audit entry |
|---------|--------------|-------------|
| Purpose | Engine fan-out | Compliance / forensics |
| Actor detail | Light (`actor` on envelope) | Full persona, IP, impersonator |
| Old/new values | Rarely | Yes (redacted diffs) |
| Consumers | Other engines | Humans, SIEM, analytics |
| Failure | Retry consumers | Must still persist if OLTP committed |

When both exist: set `event_id` on audit; do not make engines “consume audit to update ledger.”

---

## 10. Action vocabulary (controlled)

Format: `{domain}.{entity}.{verb}` — prefer alignment with permission keys / events.

Examples:

| Action | Entity | Typical severity |
|--------|--------|------------------|
| `access.session.login_succeeded` | AuthUser | info |
| `access.session.login_failed` | AuthUser | warning |
| `tenant.school.suspended` | School | critical |
| `tenant.onboarding.completed` | School | notice |
| `identity.person.updated` | Person | notice |
| `workforce.employment.ended` | TeacherEmployment | notice |
| `enrollment.student.admitted` | StudentAdmission | notice |
| `calendar.academic_year.closed` | AcademicYear | critical |
| `calendar.academic_year.unlocked` | AcademicYear | critical |
| `structure.class.renamed` | Class | notice |
| `config.grading_scale.version_published` | GradingScale | notice |
| `timetable.grid.published` | TimetableGrid | notice |
| `assessment.exam.published` | Assessment | notice |
| `assessment.result.corrected` | AssessmentResult | warning |
| `fee.invoice.voided` | Invoice | warning |
| `fee.waiver.approved` | Invoice | warning |
| `payment.transaction.refunded` | Payment | critical |
| `document.artifact.issued` | IssuedDocument | notice |
| `authz.role.granted` | RolePermission | warning |
| `access.impersonation.started` | AuthUser | critical |
| `ai.suggestion.accepted` | AISuggestion | notice |
| `ingestion.job.committed` | IngestionJob | notice |

Extend via E28 catalog; engines must not invent free-text actions in production.

---

## 11. Engine coverage matrix (summary)

| Engine | Must audit | Notes |
|--------|------------|-------|
| E01 Tenancy | Yes | Lifecycle, suspend |
| E02 Access | Yes | Auth events; no secrets |
| E03 AuthZ | Yes | Grants; sensitive denies |
| E04 Identity | Yes | Redact Aadhaar |
| E05 Workforce | Yes | Invite/end |
| E06 Enrollment | Yes | Admit/transfer/withdraw |
| E07 Config | Yes | Catalog archive/version |
| E08 Calendar | Yes | Year close/unlock |
| E09 Structure | Yes | Class/section structural |
| E10 Timetable | Yes | Publish grid; draft optional |
| E11 Assessment | Yes | Publish/lock/correct |
| E12 Attendance | Yes | Batch summary + corrections |
| E13 Conduct | Yes | Incidents |
| E14 Health | Yes | Redacted field flags |
| E15 Fee | Yes | T3 retention |
| E16 Payments | Yes | T3; webhook actor |
| E17–E18 | Yes | Publish paths |
| E19 Notification | Yes | Delivery ids |
| E20 Document | Yes | Issue/reissue + template version |
| E21 Reporting | Info | Job lifecycle |
| E22 Analytics | Rare | Config of dashboards |
| E23 AI | Yes | Accept; propose optional |
| E24 Marketplace | Yes | Publish listing |
| E25 Onboarding | Notice | Step/complete |
| E26 Ingestion | Yes | Commit/fail |
| E27 Media | Yes | Upload/delete issued assets |
| E28 Audit | Meta | `audit.entry.recorded` only; no recursive full copy |

---

## 12. Read model & UX (future)

| Consumer | Capability |
|----------|------------|
| School Admin / Principal / VP | Filter by date, actor, entity, action, severity |
| Super Admin | Platform + any school; impersonation trail |
| Entity drawer | “History” tab: audits where entity is primary or related |
| Export | Time-bounded compliance package |
| Teacher/Parent/Student | No general audit access (RBAC) |

Queries must be indexed on `(school_id, occurred_at DESC)`, `(entity_type, entity_id, occurred_at)`, `(actor.auth_user_id, occurred_at)`, `severity`.

---

## 13. Future analytics possibilities

Audit is a rich feed for **E22 Analytics** and ops — always aggregated / permission-gated:

| Opportunity | Signal |
|-------------|--------|
| Admin workload | Mutations per persona per day |
| Onboarding funnel | Step completion audits → drop-off |
| Security posture | Login failures, denies, impersonation frequency |
| Data quality | Correction rate (`assessment.result.corrected`, ledger compensations) |
| Fee risk | Void/waiver/refund rates by school |
| Config churn | How often grading/templates/periods version |
| Ingestion health | Commit vs fail jobs; blocked CSV rate |
| AI adoption | Accept vs dismiss suggestions |
| Compliance drift | Schools below retention export cadence |
| Anomaly detection | Burst deletes, off-hours year unlock, unusual refund volume |

**Constraint:** Analytics must not re-store forbidden PII; prefer counts and ids. SIEM export for Super Admin security monitoring.

---

## 14. Privacy & compliance notes

- Aadhaar: log only “aadhaar_hash set/cleared,” never hash value in audit JSON if avoidable (hash already sensitive).  
- Minors: student-related audits inherit school retention; export restricted.  
- Right to erasure: operational anonymization may scrub `old_values`/`new_values` display fields under legal process; T3 financial rows retain amounts/ids as required by law — counsel per jurisdiction.  
- India DPDP / school board rules: retention floors in §7 are defaults pending legal review.

---

## 15. Placement rule for features

Every mutating feature must declare:

1. Audit `action` name  
2. Primary `entity_type` / id  
3. Severity + retention tier  
4. Fields in `old_values` / `new_values` (and redactions)  
5. Sync vs async write  
6. Whether domain event also emitted  

No important write ships without an audit intent.

---

## 16. Implementation roadmap (no code now)

1. Finalize `AuditEntry` schema + RLS (`audit.entry.read`).  
2. Outbox helper used by all server actions.  
3. Instrument E01/E02/E05/E06 first (shipped surfaces).  
4. Fee/Payment/Document before those engines GA (T3).  
5. Retention worker + export.  
6. SIEM / Analytics consumers of `audit.entry.recorded`.

---

## 17. Relation to other docs

| Doc | Role |
|-----|------|
| `business-engines.md` E28 | Engine ownership |
| `domain-model.md` AuditEntry | Entity stub |
| `system-events.md` | `audit.entry.recorded` + domain events |
| `rbac.md` | Who may read / who triggers break-glass |
| `versioning.md` | Why diffs + version ids; audit immutable |
| `MASTER.md` §23 | Index |
| `notification-engine.md` | Delivery side of user-visible alerts |
| `ai-architecture.md` | Accept path audited as human |

---

## 18. Maintenance

| Change | Action |
|--------|--------|
| New important action | Add vocabulary row + severity/retention |
| New sensitive field | Add redaction rule |
| Jurisdiction change | Adjust §7 floors |
| Analytics product | Consume events; don’t fork audit schema |

---

*End of audit logging architecture.*
