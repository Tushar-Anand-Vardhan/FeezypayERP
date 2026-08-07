# FeezypayERP — Communication Configuration Engine (E18 content config)

> **Phase:** 1 — Implementation  
> **Created:** 2026-08-07  
> **Owner engine:** **E18 Communication** (configuration only)  
> **Companion:** E19 Notification owns **sending** (not built here)  
> **Companions:** [`MASTER.md`](../MASTER.md) · [`notification-engine.md`](notification-engine.md) · [`business-engines.md`](business-engines.md)

---

## 1. Scope

| Supported (config) | Explicitly out of scope |
|--------------------|-------------------------|
| Announcement categories | Queues / delivery attempts |
| Priority levels | Provider API calls |
| Audience groups (filter rules) | Audience resolution at send-time |
| Message templates by channel (notification / email / WhatsApp / SMS / in_app) | Rendering to parents |
| Versioned template bodies | Consent write UX |
| Delivery rules | Automation execution |
| Approval rules | Campaign sending |
| Future automation / campaign shells | |

**Hard rules**
- **E18 = content + config**; **E19 = pipe + retries**.
- Templates are versioned; publish → immutable + `is_current`.
- No sending from this module.

---

## 2. Schema

`supabase/migrations/20260807210000_communication_configuration_engine.sql`

| Table | Purpose |
|-------|---------|
| `comm_announcement_categories` | Category catalog |
| `comm_priority_levels` | Priority catalog |
| `comm_audience_groups` | Named audience filter config |
| `comm_message_templates` | Channel templates |
| `comm_message_template_versions` | Versioned subject/body/placeholders |
| `comm_delivery_rules` | Event → channels / priority / audience / template |
| `comm_approval_rules` | Approval gates |
| `comm_automations` | FUTURE shell |
| `comm_campaigns` | FUTURE shell |

---

## 3. Module

```text
lib/communications/
  types.ts
  validation.ts
  server-helpers.ts
  catalog-actions.ts      # categories + priorities
  audiences-actions.ts
  templates-actions.ts
  rules-actions.ts        # delivery + approval + future shells
```

---

## 4. Tests

`npx tsx scripts/smoke-communication-validation.ts`

---

*MASTER §37.*
