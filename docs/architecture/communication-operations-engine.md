# Communication Operations Engine (E18 ops) + Notification pipe (E19)

> **Phase:** 2 — Operations  
> **Created:** 2026-08-07  
> **Status:** Backend `SHIPPED`. UI `NOT BUILT`. External providers stubbed.  
> **Modules:** `lib/communications/**` (ops) · `lib/notifications/**` (E19)  
> **Migration:** `supabase/migrations/20260807300000_communication_operations_engine.sql`  
> **Config companion:** [`communication-configuration-engine.md`](communication-configuration-engine.md) (§37)  
> **Design companion:** [`notification-engine.md`](notification-engine.md) (§24)  
> **MASTER:** §49

---

## 1. Purpose

Own **operational school communications** (compose, target, schedule, attach, publish) and hand delivery to **E19 Notification**.

| Engine | Owns |
|--------|------|
| **E18** | Message content, kind, audience intent, attachments (media uuid refs), schedule, publish/cancel, audit |
| **E19** | Delivery requests, attempts, outbox, read receipts, notification history |

Domain modules must not call WhatsApp/email/SMS SDKs.

---

## 2. Message kinds

| Kind | Typical audience |
|------|------------------|
| `announcement` | Parents + staff (school-wide) |
| `circular` | Parents + staff |
| `department` | Department staff (`department_id` required) |
| `teacher` | Staff |
| `class` | Class students + parents (`class_id` required) |
| `parent_notice` | Parents |
| `student_notice` | Students |

---

## 3. Lifecycle

```text
draft → scheduled | published
scheduled → published | cancelled
published → archived (soft)
any → cancelled (queued deliveries cancelled)
```

Publish / schedule fans out one `notification_delivery_requests` row per recipient × channel via `enqueueDelivery`.

- **`in_app`:** processed immediately (`sent` + attempt).
- **email / whatsapp / sms / push:** left `queued` (stub) until provider workers.

Read receipts: `markNotificationReadAction` → `status=read`, `read_at`.

---

## 4. Tables

| Table | Role |
|-------|------|
| `comm_messages` | Operational messages |
| `comm_message_audit_log` | Append-only audit |
| `notification_types` | E19 type catalog (seeded) |
| `notification_delivery_requests` | Delivery + read receipts |
| `notification_delivery_attempts` | Per-try log |
| `notification_outbox` | Worker queue |

Config tables (`comm_announcement_categories`, templates, priorities, audiences, rules) remain §37.

---

## 5. API

### E18 ops (`lib/communications/`)

| Action | Notes |
|--------|-------|
| `createCommMessageAction` | Draft / schedule / publish-now |
| `updateCommMessageAction` | Draft/scheduled only |
| `publishCommMessageAction` | Fan-out deliveries |
| `cancelCommMessageAction` | Cancel message + queued deliveries |
| `archiveCommMessageAction` | Soft-archive |
| `listCommMessagesAction` / `getCommMessageAction` | Query + receipt summary |
| `listMessageReadReceiptsAction` | Per-message receipts |
| `listCommMessageAuditAction` | Audit |
| `resolveMessageAudience` | Targeting helper (no send) |

### E19 (`lib/notifications/`)

| Action / fn | Notes |
|-------------|-------|
| `enqueueDelivery` | Create request + outbox; process in_app |
| `listNotificationHistoryAction` | Notification history |
| `markNotificationReadAction` | Read receipt |
| `listNotificationAttemptsAction` | Attempts |
| `listNotificationTypesAction` | Catalog |

---

## 6. Placement

- WF-ADM-06 · WF-PRI-04 · WF-HOD-05 · WF-TCH-04 · WF-SYS-04  
- Department announcements (E05) may link via `department_announcement_id`  
- Consent / marketing quiet hours remain future (prefer transactional for school notices)

---

## 7. Non-goals (this ship)

- Admin compose UI  
- Real WhatsApp / SMTP / SMS / push providers  
- Two-way chat threads  
- Campaign / automation execution (`comm_campaigns` / `comm_automations` stubs)

---

## 8. Tests

`npx tsx scripts/smoke-communication-ops-validation.ts`
