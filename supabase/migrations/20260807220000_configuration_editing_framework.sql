-- Phase 1: Configuration Editing Framework (cross-cutting)
-- Append-only audit entries (E28 minimal) + config change history.
-- Supports Edit / Archive / Restore / Duplicate / History / Version tracking.

-- ---------------------------------------------------------------------------
-- 1. Audit entries (E28 — append-only for app paths)
-- ---------------------------------------------------------------------------

create table public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  school_id uuid references public.schools (id) on delete cascade,
  actor_type text not null default 'user',
  auth_user_id uuid references auth.users (id) on delete set null,
  persona text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  severity text not null default 'info',
  outcome text not null default 'succeeded',
  correlation_id uuid,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  check (
    actor_type in ('user', 'system', 'webhook', 'ai', 'service_role')
  ),
  check (
    severity in ('debug', 'info', 'notice', 'warning', 'critical')
  ),
  check (
    outcome in ('succeeded', 'failed', 'denied')
  )
);

comment on table public.audit_entries is
  'E28 append-only audit. Config editing framework writes here; not business source of truth.';

create index audit_entries_school_occurred_idx
  on public.audit_entries (school_id, occurred_at desc);

create index audit_entries_entity_idx
  on public.audit_entries (entity_type, entity_id, occurred_at desc);

create index audit_entries_action_idx
  on public.audit_entries (school_id, action, occurred_at desc);

alter table public.audit_entries enable row level security;
revoke all on public.audit_entries from anon;
-- Append-only for authenticated: insert + select; no update/delete
grant select, insert on public.audit_entries to authenticated;

create policy audit_entries_own_select on public.audit_entries
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy audit_entries_own_insert on public.audit_entries
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Config change history (entity snapshots for admin History UI)
-- ---------------------------------------------------------------------------

create table public.config_change_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  version_label text,
  snapshot jsonb not null default '{}'::jsonb,
  diff jsonb not null default '{}'::jsonb,
  soft_migration jsonb,
  audit_entry_id uuid references public.audit_entries (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    action in (
      'create',
      'update',
      'archive',
      'restore',
      'duplicate',
      'publish_version',
      'retire',
      'evaluate'
    )
  )
);

comment on table public.config_change_history is
  'Config editing framework history. Snapshots + diffs for admin History views.';
comment on column public.config_change_history.soft_migration is
  'Optional recommended soft-migration strategy when edit was dangerous/blocked.';

create index config_change_history_entity_idx
  on public.config_change_history (entity_type, entity_id, created_at desc);

create index config_change_history_school_idx
  on public.config_change_history (school_id, created_at desc);

alter table public.config_change_history enable row level security;
revoke all on public.config_change_history from anon;
grant select, insert on public.config_change_history to authenticated;

create policy config_change_history_own_select on public.config_change_history
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy config_change_history_own_insert on public.config_change_history
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
