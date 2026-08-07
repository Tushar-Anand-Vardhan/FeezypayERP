# FeezypayERP — Notification Operations Platform

> **Phase:** 2.8 — Ops notify chains  
> **Created:** 2026-08-07  
> **Status:** Platform `SHIPPED` (domain outbox → orchestrator → E19 → workers). External providers stub-safe.  
> **Modules:** `lib/domain-events/` · `lib/notify-orchestration/` · `lib/notifications/`  
> **Migration:** `supabase/migrations/20260807430000_notification_operations.sql`  
> **Companions:** MASTER §58 · [`notification-engine.md`](notification-engine.md) · [`system-events.md`](system-events.md)

---

## 1. Purpose

Wire Phase 2 ops facts to E19 without domains calling providers.

| Rule | Meaning |
|------|---------|
| N1 | Domains **emit** `domain_event_outbox` only |
| N2 | Orchestrator maps event → notify type(s) + audience → `enqueueDelivery` |
| N3 | E19 owns requests, attempts, notification outbox, adapters, retry |
| N4 | Adapters never crash domain writes; missing keys → stub / skip |

```text
Domain write → emitDomainEvent → domain_event_outbox
  → processDomainOutbox → orchestrator → enqueueDelivery
  → notification_outbox → worker → ChannelAdapter
```

---

## 2. Wired chains

| Event | Notify type | Recipients |
|-------|-------------|------------|
| `attendance.record.marked` (absent) | `attendance.absent_alert` | Linked parents |
| `assessment.results.published` | `assessment.results_published` | Section students (+ parents) |
| `conduct.incident.recorded` | `conduct.incident` | Parents if visible + school admins |
| `homework.assigned` | `homework.assigned` | Section students (+ parents if visible) |
| `engagement.event.published` | `engagement.event_published` | School members (in_app) |
| `document.artifact.issued` | `document.ready` | Student + linked parents |

E18 human compose remains the existing fan-out path.

---

## 3. Workers

- `processDomainEventOutbox` — claim domain rows → orchestrator  
- `processNotificationOutbox` — claim delivery outbox → adapters + retry/dead-letter  
- Entry: `scripts/run-notification-workers.ts` · `POST /api/internal/notify-worker` (secret)

---

## 4. Placement

New ops mutations that should notify must call `emitDomainEvent` after a successful write — never import adapters or WhatsApp/SES.

---

*Companion: MASTER §58.*
