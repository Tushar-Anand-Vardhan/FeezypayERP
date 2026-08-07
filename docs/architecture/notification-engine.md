# FeezypayERP — Notification Engine Architecture

> **Phase:** 0.5 design + Phase 2 runtime (minimal) + Phase 2.8 ops platform  
> **Created:** 2026-08-06 · **Runtime:** 2026-08-07 (§49) · **Ops chains:** 2026-08-07 (§58)  
> **Status:** Canonical design for **E19 Notification** — pipe `SHIPPED` (`lib/notifications/`); domain outbox + orchestrator + workers `SHIPPED` ([`notification-operations.md`](notification-operations.md)); provider adapters stub-safe until keys exist  
> **Runtime companion:** [`communication-operations-engine.md`](communication-operations-engine.md)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`business-engines.md`](business-engines.md) · [`domain-model.md`](domain-model.md) · [`system-events.md`](system-events.md) · [`rbac.md`](rbac.md) · [`versioning.md`](versioning.md) · [`audit-log.md`](audit-log.md)  
> **Rule:** Notifications do **not** belong to Fee, Attendance, Assessment, or any other domain module. Domains **emit events**; Communication **composes**; Notification **delivers**.

---

## 1. Why a shared Notification Engine

If Fee embeds WhatsApp send logic, Attendance embeds SMS, and Assessment embeds email:

- Retries, provider keys, and quiet hours are duplicated and inconsistent  
- Consent is bypassed  
- Delivery analytics fragment  
- Channel swaps (Meta → another BSP) touch every module  

**Correct split (P6):**

```text
  Domain engine (E11/E12/E15/…)
        │  emits domain event  (system-events catalogue)
        ▼
  E18 Communication
        │  resolve audience, apply template + consent, render payload
        │  emit communication.message.ready_for_delivery
        ▼
  E19 Notification
        │  enqueue, schedule, route channel, retry, webhooks
        ▼
  Provider (Email / WhatsApp / SMS / Push / In-app)
```

| Engine | Owns | Must not own |
|--------|------|--------------|
| **Domain** (Fee, etc.) | Business fact + event | Provider SDKs, retries, templates as source of truth |
| **E18 Communication** | Message content, templates, consent, audience intent, in-app inbox copy | Delivery attempts, SMTP/WhatsApp API calls |
| **E19 Notification** | Jobs, attempts, channel adapters, backoff, provider ids, status | Fee balances, marks, editorial long-form as truth |
| **E02 Access** | Auth sessions | May request credential mail via E19 (or Auth mailer until unified) |

---

## 2. Core objects

| Object | Owner | Purpose |
|--------|-------|---------|
| **NotificationType** | E19 catalog (+ E18 template binding) | Stable code for kind of notice (`fee.invoice.overdue`) |
| **Message** / Announcement | E18 | Content + audience + template version pin |
| **CommunicationConsent** | E18 | Opt-in/out per person × channel |
| **DeliveryRequest** | E19 | One intended send (message × recipient × channel) |
| **DeliveryAttempt** | E19 | One try against a provider |
| **ChannelEndpoint** | E19 read-model from Identity | Email, phone E.164, push token, WhatsApp id |
| **ProviderAccount** | E19 / platform | School or platform credentials (secrets outside audit payloads) |

---

## 3. Notification types

Controlled vocabulary. Domains request by **type code**; they do not invent free-text channel logic.

### 3.1 Catalog (v0)

| Type code | Domain trigger (event) | Default audience | Default channels | Default priority |
|-----------|------------------------|------------------|------------------|------------------|
| `tenant.welcome` | `tenant.onboarding.completed` | School admins | email, in_app | normal |
| `access.invite` | `workforce.teacher.invited` / parent invite | Invitee | email (magic link) | high |
| `access.password_reset` | `access.password_reset.requested` | User | email | high |
| `workforce.teacher_joined` | `workforce.teacher.joined` | School admins (optional) | in_app | low |
| `enrollment.student_admitted` | `enrollment.student.admitted` | Parents linked | email, whatsapp*, in_app | normal |
| `enrollment.withdrawn` | `enrollment.student.withdrawn` | Parents, advisors | email, in_app | normal |
| `attendance.marked_digest` | batch / schedule | Class teacher | in_app | low |
| `attendance.absent_alert` | `attendance.record.marked` (absent) | Parents | whatsapp*, sms*, push, in_app | high |
| `attendance.threshold_breached` | `attendance.threshold.breached` | Parents, admins | email, whatsapp*, in_app | high |
| `assessment.exam_published` | `assessment.exam.published` | Students, parents, teachers | in_app, push, email | normal |
| `assessment.results_published` | `assessment.results.published` | Students, parents | in_app, push, email, whatsapp* | high |
| `conduct.incident` | `conduct.incident.recorded` | Parents (policy), admins | email, in_app | high |
| `fee.invoice_created` | `fee.invoice.created` | Payers (parents) | email, in_app, whatsapp* | normal |
| `fee.invoice_overdue` | `fee.invoice.overdue` | Payers | email, whatsapp*, sms*, push | high |
| `fee.payment_succeeded` | `payment.transaction.succeeded` | Payer | email, in_app, push | normal |
| `fee.payment_failed` | `payment.transaction.failed` | Payer | email, push, in_app | high |
| `document.ready` | `document.artifact.issued` / report card | Subject + parents | email (link), in_app | normal |
| `engagement.event_published` | `engagement.event.published` | Audience | in_app, push, email | normal |
| `engagement.event_reminder` | schedule before start | RSVPs / audience | push, whatsapp*, sms* | normal |
| `communication.announcement` | `communication.announcement.published` | Audience | in_app + opted channels | normal |
| `system.security_alert` | auth anomalies | School admin / SA | email, in_app | critical |

\*Channel only if consent + school feature flag + provider configured.

### 3.2 Type metadata

Each type declares:

- Allowed channels  
- Priority default + whether user can mute  
- Consent category (`transactional` vs `marketing`)  
- Template key (E18)  
- Idempotency scope (e.g. one overdue notice per invoice per day)  
- Quiet-hours behavior (bypass if `critical`/`high` transactional)

**Transactional** (fees paid, OTPs, security, absence same-day): deliver despite marketing opt-out; still respect hard legal blocks / invalid endpoint.  
**Marketing / bulk announcement**: require explicit opt-in where regulated.

---

## 4. Delivery channels

| Channel | Code | Status | Adapter (future) | Endpoint source |
|---------|------|--------|------------------|-----------------|
| **In-app** | `in_app` | First to ship | App inbox / realtime | `person_id` + school |
| **Email** | `email` | Future (near) | SES / Resend / Supabase | `persons.email` |
| **WhatsApp** | `whatsapp` | Future | Meta Cloud API / BSP | E.164 + WhatsApp consent |
| **SMS** | `sms` | Future | Twilio / MSG91 / etc. | E.164 phone |
| **Push** | `push` | Future | FCM / APNs | Device tokens |
| **Auth mailer** | `auth_email` | Partial today | Supabase Auth | Auth user email — migrate toward E19 |

### 4.1 Channel rules

1. Multi-channel fan-out is **explicit per type** (not “send everywhere”).  
2. Fallback chain optional: e.g. `whatsapp → sms → email` on hard bounce.  
3. Each channel = separate `DeliveryRequest` (independent retry).  
4. Provider secrets live in platform/school config — never in message body or audit diffs.

### 4.2 In-app (baseline channel)

- Always available for authenticated personas  
- E18 may write inbox item; E19 records delivery as immediate `delivered` for in-app  
- Deep links to ERP routes (`/fees/invoices/:id`)

---

## 5. Recipients

### 5.1 Resolution (who)

Audience is resolved in **E18** (or a shared recipient service called by E18), never hard-coded inside Fee:

| Resolver | Meaning |
|----------|---------|
| `person` | Explicit `person_id` |
| `auth_user` | Invite / password flows |
| `employment` | Staff at school |
| `admission` | Student via admission → student person |
| `parent_of_admission` | All linked parents/guardians |
| `section` / `class` | Students + optional parents + class teacher |
| `role` | All active `school_admin` / teachers (RBAC) |
| `event_audience` | From E17 audience definition |
| `payer_of_invoice` | Fee payer person(s) |

Output: list of `{ person_id?, auth_user_id?, school_id, locale, endpoints[] }`.

### 5.2 Endpoint selection

E19 picks endpoints for requested channels:

- Skip missing email/phone/token  
- Skip channel if `CommunicationConsent` denies (non-transactional)  
- Prefer verified endpoints when flagged  

### 5.3 Deduplication

Same person receiving the same `type + dedupe_key` within window → single delivery (configurable).  
Parents linked to multiple children: separate notifications unless digest mode.

---

## 6. Templates

### 6.1 Ownership

| Layer | Owner | Content |
|-------|-------|---------|
| **MessageTemplate** (+ versions) | **E18** | Subject, body, WhatsApp template name/locale, placeholders |
| **Render** | E18 | Substitute ids → display fields; pin `template_version_id` |
| **Provider template** | E19 config | Meta/SMS pre-approved template ids mapped to E18 template codes |
| **Document PDF** | E20 | Attachments by `media_id` / signed URL — E19 sends link, not raw PDF bytes in WhatsApp when possible |

Versioning: follow [`versioning.md`](versioning.md) — sent messages pin template version; edit = new version.

### 6.2 Placeholder contract

Templates receive a **typed context** from the domain event payload + loaded read models:

```text
school.name, student.display_name, invoice.amount, invoice.due_date,
exam.name, deep_link, ...
```

Rules:

- No raw Aadhaar / full medical notes in templates  
- Amounts/dates formatted by locale  
- Deep links short-lived signed URLs where needed  

### 6.3 Localization

`locale` from person preference → school default → `en-IN`.  
E18 stores locale variants of the same template code.

---

## 7. Priorities

| Priority | Code | Queue | Quiet hours | Examples |
|----------|------|-------|-------------|----------|
| **Critical** | `critical` | Dedicated | Bypass | Security, payment fraud, safety |
| **High** | `high` | Fast | Bypass for transactional | Absence alert, overdue fee, results published |
| **Normal** | `normal` | Standard | Respect | Invoice created, announcements |
| **Low** | `low` | Bulk / digest | Respect + batch | Digests, optional FYI |

Priority influences: worker concurrency, retry aggressiveness, and whether scheduling may delay to next morning.

---

## 8. Scheduling

| Mode | Behavior |
|------|----------|
| **Immediate** | Enqueue now |
| **Delayed** | `send_after` timestamp (reminders) |
| **Cron / window** | School-local digest (e.g. 18:00 attendance summary) |
| **Quiet hours defer** | If `normal`/`low` and now in quiet window → `send_after = window_end` |
| **Cancel** | If underlying fact voided before send (invoice voided) → cancel queued jobs by `dedupe_key` / `correlation_id` |

School settings (E07/E18): timezone, quiet hours, weekend policy.

E19 stores `scheduled_at` / `send_after` on `DeliveryRequest`; workers poll due jobs.

---

## 9. Triggers

### 9.1 Primary: domain events

Notification **must not** be invoked via direct Fee→WhatsApp calls. Triggers:

1. Domain emits catalogue event  
2. E18 policy maps `event_name` → notification type(s) (or no-op)  
3. E18 composes Message → `communication.message.ready_for_delivery`  
4. E19 creates DeliveryRequest(s)  

### 9.2 Secondary: schedules

Calendar/cron producers emit events (`engagement.event_reminder due`) or E19 internal schedulers that only fire **after** E18 composition for typed reminders.

### 9.3 Tertiary: user-authored

Admin publishes Announcement → E18 → E19 (same pipe).

### 9.4 Trigger map (illustrative)

| Event | → Types |
|-------|---------|
| `fee.invoice.overdue` | `fee.invoice_overdue` |
| `attendance.threshold.breached` | `attendance.threshold_breached` |
| `assessment.results.published` | `assessment.results_published` + optional `document.ready` later |
| `payment.transaction.succeeded` | `fee.payment_succeeded` |
| `workforce.teacher.invited` | `access.invite` |
| `communication.announcement.published` | `communication.announcement` |
| `document.report_card.generated` | `document.ready` |

---

## 10. Retry behaviour

### 10.1 Attempt lifecycle

```text
queued → sending → sent → delivered
                 ↘ failed → (retry?) → dead_letter
                 ↘ bounced (hard) → no retry
```

Events: `notification.delivery.sent` | `delivered` | `bounced` (catalogue).

### 10.2 Retry policy (defaults)

| Failure class | Examples | Retries | Backoff |
|---------------|----------|---------|---------|
| **Transient** | 429, 503, timeout, network | 5–8 | Exponential + jitter (1m → 1h cap) |
| **Rate limited** | Provider 429 | As transient; honor `Retry-After` | |
| **Soft bounce** | Mailbox full | 3 | Longer spacing |
| **Hard bounce** | Invalid address, WA user not on WhatsApp | **0** | Mark endpoint unhealthy |
| **Auth / config** | Bad API key | **0** | Alert school/platform admin |
| **Template rejected** | WhatsApp template mismatch | **0** | Alert; fix template mapping |
| **Quiet cancel** | User opted out mid-queue (marketing) | Cancel | |

### 10.3 Idempotency

`idempotency_key = hash(type, school_id, recipient_ref, channel, dedupe_key)`  
Provider send must use the same key where supported to avoid double SMS on retry.

### 10.4 Dead letter

After max retries → `dead_letter`; admin delivery log; optional fallback channel once; audit `warning`.

### 10.5 Webhooks

Providers call E19 status webhook → update attempt → emit `delivered`/`bounced`.  
Webhook handler is `system` actor; audited lightly (provider message id).

---

## 11. Future WhatsApp integration

| Topic | Design |
|-------|--------|
| **API** | Meta Cloud API or India-ready BSP; school or platform WABA |
| **Templates** | Only pre-approved templates for business-initiated; map E18 template code → Meta `template_name` + language |
| **Session messages** | User-initiated 24h window for two-way (E18 threads future); E19 still sends |
| **Consent** | `CommunicationConsent` channel `whatsapp` required for non-transactional; transactional still needs valid WA number |
| **Opt-out** | Provider STOP → E18 consent update via E19 webhook event |
| **Media** | Prefer links; document PDFs via E20 signed URL |
| **Failover** | Hard fail → optional SMS/email fallback per type |
| **Not in domain modules** | Fee never imports Meta SDK |

---

## 12. Future Email integration

| Topic | Design |
|-------|--------|
| **Provider** | SES / Resend / similar; SPF/DKIM per school custom domain later |
| **Content** | HTML + text from E18 render; attachments = links or small receipts |
| **Auth emails** | Migrate invite/reset from Auth-only mailer to E19 `access.*` types where product-owned |
| **Bounce/complaint** | Webhook → unhealthy email endpoint; suppress future marketing |
| **Batching** | Digest emails for low priority |
| **Tracking** | Open/click optional; privacy-minimized; not required for transactional |

---

## 13. Future Push Notifications

| Topic | Design |
|-------|--------|
| **Providers** | FCM (Android), APNs (iOS); web push later |
| **Tokens** | Stored as Media/Identity-adjacent device endpoints; E19 owns send |
| **Payload** | Title/body short + deep link; no sensitive fee amounts in clear on lock screen if policy says so (prefer “You have a fee update”) |
| **Collapse keys** | Collapse duplicate high-chatter types |
| **Permission** | OS permission + in-app preference (E18) |

---

## 14. Future SMS

| Topic | Design |
|-------|--------|
| **Providers** | MSG91 / Twilio / etc.; DLT template IDs where required (India) |
| **Use** | High-priority fallback, OTP-like transactional, absence alerts when WA unavailable |
| **Cost controls** | School caps; prefer WA/email when possible |
| **Templates** | Registered SMS templates mapped like WhatsApp |
| **Consent** | Marketing SMS opt-in; transactional per local regs |

---

## 15. Preferences, consent, and quiet hours

```text
Type (transactional?) + Channel + Consent + Quiet hours + School feature flags
        → allow | defer | skip
```

| Actor | Can configure |
|-------|---------------|
| Person | Channel opt-in/out (non-mandatory transactional) |
| School Admin | Enable channels, quiet hours, default locale, provider routing |
| Super Admin | Platform provider accounts, kill switches |

RBAC: `notification.delivery.read` for logs; compose/publish via E18 permissions (`communication.announcement.publish`).

---

## 16. Observability & audit

| Concern | Mechanism |
|---------|-----------|
| Delivery log UI | E19 attempts by school |
| Domain analytics | Rates via E22 on delivery events |
| Audit | `notification.delivery.sent/bounced` + compose actions in E18; no full message body in audit by default ([`audit-log.md`](audit-log.md)) |
| PII | Phones/emails in delivery rows; redact in exports per policy |

---

## 17. Anti-patterns (reject in review)

| Anti-pattern | Do this instead |
|--------------|-----------------|
| `sendWhatsApp()` inside Fee Engine | Emit `fee.invoice.overdue` |
| Attendance stores “SMS sent” boolean as truth | E19 delivery status |
| Hard-coded English strings in workers | E18 templates + versions |
| Infinite silent retries | Dead letter + alert |
| One mega-notification table owned by each module | Shared E19 |
| Skipping consent for marketing blasts | E18 consent gate |

---

## 18. Implementation roadmap (no code now)

1. **In-app only** pipe: event → E18 message → E19 `in_app` delivered.  
2. Outbox + worker + delivery attempt model.  
3. **Email** adapter + bounce webhooks.  
4. **WhatsApp** + template mapping + consent UX.  
5. **Push** device registration.  
6. **SMS** fallback + DLT.  
7. Digests, quiet hours, multi-provider failover.

---

## 19. Placement rule for features

Any feature that “should notify someone” must specify:

1. Domain **event** name (catalogue)  
2. Notification **type** code(s)  
3. Recipient resolver  
4. Channels + priority  
5. Template key (E18)  
6. Transactional vs marketing  
7. Dedupe / schedule / cancel rules  

No feature ships provider calls outside E19.

---

## 20. Relation to other docs

| Doc | Role |
|-----|------|
| `business-engines.md` E18/E19 | Boundaries |
| `system-events.md` | Triggers + `notification.delivery.*` |
| `domain-model.md` | Notification, MessageTemplate, Consent |
| `rbac.md` | Who reads delivery / publishes announcements |
| `versioning.md` | Template versions |
| `audit-log.md` | Delivery auditing |
| `MASTER.md` §24 | Index |
| `ai-architecture.md` | AI may draft messages; must not send via providers directly |

---

## 21. Maintenance

| Change | Action |
|--------|--------|
| New notify-worthy fact | Add domain event + type row + template |
| New channel | Adapter + consent + retry class |
| Provider swap | E19 config only |

---

*End of Notification Engine architecture.*
