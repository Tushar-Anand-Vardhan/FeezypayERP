-- Operational Notification Platform: domain_event_outbox, notify type seeds,
-- delivery status extensions, optional provider config flags.

-- ---------------------------------------------------------------------------
-- 1. domain_event_outbox
-- ---------------------------------------------------------------------------

create table if not exists public.domain_event_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  locked_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint domain_event_outbox_idempotency_unique
    unique (school_id, idempotency_key)
);

create index if not exists domain_event_outbox_pending_idx
  on public.domain_event_outbox (occurred_at)
  where processed_at is null;

create index if not exists domain_event_outbox_school_idx
  on public.domain_event_outbox (school_id, occurred_at desc);

comment on table public.domain_event_outbox is
  'Domain facts for notify orchestration — domains insert only; workers process.';

alter table public.domain_event_outbox enable row level security;
revoke all on public.domain_event_outbox from anon;
grant select, insert, update on public.domain_event_outbox to authenticated;

drop policy if exists domain_event_outbox_school on public.domain_event_outbox;
create policy domain_event_outbox_school
  on public.domain_event_outbox
  for all
  to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. Seed missing notification types
-- ---------------------------------------------------------------------------

insert into public.notification_types (code, name, default_channels, default_priority, consent_category)
values
  ('attendance.absent_alert', 'Student absent alert', array['in_app','whatsapp'], 'high', 'transactional'),
  ('attendance.threshold', 'Attendance threshold', array['in_app','email'], 'high', 'transactional'),
  ('engagement.event_reminder', 'Event reminder', array['in_app'], 'normal', 'transactional'),
  ('homework.assigned', 'Homework assigned', array['in_app'], 'normal', 'transactional'),
  ('homework.due_reminder', 'Homework due reminder', array['in_app'], 'normal', 'transactional')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Extend delivery request statuses
-- ---------------------------------------------------------------------------

alter table public.notification_delivery_requests
  drop constraint if exists notification_delivery_requests_status_check;

alter table public.notification_delivery_requests
  add constraint notification_delivery_requests_status_check
  check (
    status in (
      'queued',
      'scheduled',
      'sending',
      'sent',
      'delivered',
      'failed',
      'bounced',
      'read',
      'cancelled',
      'dead_letter'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Optional provider config flags (school / channel)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_provider_configs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  channel text not null
    check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'push')),
  enabled boolean not null default true,
  live_mode boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, channel)
);

alter table public.notification_provider_configs enable row level security;
revoke all on public.notification_provider_configs from anon;
grant select, insert, update on public.notification_provider_configs to authenticated;

drop policy if exists notification_provider_configs_school
  on public.notification_provider_configs;
create policy notification_provider_configs_school
  on public.notification_provider_configs
  for all
  to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));
