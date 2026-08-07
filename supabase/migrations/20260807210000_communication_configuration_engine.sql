-- Phase 1: Communication Configuration Engine (E18 content config surface)
-- Categories, templates (email/WhatsApp/SMS/notification), priorities,
-- audience groups, delivery rules, approval rules.
-- NO sending / queues / delivery attempts (E19). FUTURE: automations, campaigns.

-- ---------------------------------------------------------------------------
-- 1. Announcement categories
-- ---------------------------------------------------------------------------

create table public.comm_announcement_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  colour text,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_announcement_categories is
  'E18 announcement category catalog. Not delivery.';

create unique index comm_announcement_categories_school_active_code_unique_idx
  on public.comm_announcement_categories (school_id, lower(code))
  where archived_at is null;

create unique index comm_announcement_categories_school_active_name_unique_idx
  on public.comm_announcement_categories (school_id, lower(name))
  where archived_at is null;

alter table public.comm_announcement_categories enable row level security;
revoke all on public.comm_announcement_categories from anon;
grant select, insert, update on public.comm_announcement_categories to authenticated;

create policy comm_announcement_categories_own on public.comm_announcement_categories
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Priority levels
-- ---------------------------------------------------------------------------

create table public.comm_priority_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  rank integer not null default 0,
  bypass_quiet_hours boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rank >= 0)
);

comment on table public.comm_priority_levels is
  'E18 configurable priority levels (critical/high/normal/low). Delivery queue behaviour is E19.';

create unique index comm_priority_levels_school_active_code_unique_idx
  on public.comm_priority_levels (school_id, lower(code))
  where archived_at is null;

alter table public.comm_priority_levels enable row level security;
revoke all on public.comm_priority_levels from anon;
grant select, insert, update on public.comm_priority_levels to authenticated;

create policy comm_priority_levels_own on public.comm_priority_levels
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Audience groups (filter config — no resolution runtime here)
-- ---------------------------------------------------------------------------

create table public.comm_audience_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  filter_rules jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_audience_groups is
  'E18 named audience groups. filter_rules describe who; resolution at send-time (future).';
comment on column public.comm_audience_groups.filter_rules is
  'JSON: roles[], class_ids[], section_ids[], include_parents, include_students, include_staff, …';

create unique index comm_audience_groups_school_active_code_unique_idx
  on public.comm_audience_groups (school_id, lower(code))
  where archived_at is null;

alter table public.comm_audience_groups enable row level security;
revoke all on public.comm_audience_groups from anon;
grant select, insert, update on public.comm_audience_groups to authenticated;

create policy comm_audience_groups_own on public.comm_audience_groups
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Message templates (channel-specific content config)
-- ---------------------------------------------------------------------------

create table public.comm_message_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  channel text not null,
  category_id uuid references public.comm_announcement_categories (id) on delete set null,
  locale text not null default 'en-IN',
  status text not null default 'draft',
  provider_template_name text,
  provider_template_locale text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    channel in (
      'notification',
      'email',
      'whatsapp',
      'sms',
      'in_app'
    )
  ),
  check (status in ('draft', 'published', 'retired'))
);

comment on table public.comm_message_templates is
  'E18 message templates by channel. Content only — E19 owns sending.';
comment on column public.comm_message_templates.provider_template_name is
  'Optional Meta/DLT provider template id/name mapping (config); send is E19.';

create unique index comm_message_templates_school_channel_code_active_unique_idx
  on public.comm_message_templates (school_id, channel, lower(code))
  where archived_at is null;

create index comm_message_templates_channel_idx
  on public.comm_message_templates (school_id, channel)
  where archived_at is null;

alter table public.comm_message_templates enable row level security;
revoke all on public.comm_message_templates from anon;
grant select, insert, update on public.comm_message_templates to authenticated;

create policy comm_message_templates_own on public.comm_message_templates
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Template versions (immutable after publish)
-- ---------------------------------------------------------------------------

create table public.comm_message_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.comm_message_templates (id) on delete restrict,
  version integer not null check (version >= 1),
  subject text,
  body text not null default '',
  placeholders jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  change_summary text,
  published_at timestamptz,
  is_immutable boolean not null default false,
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

comment on table public.comm_message_template_versions is
  'E18 versioned template bodies. Sent messages (future) pin version id.';
comment on column public.comm_message_template_versions.placeholders is
  'JSON array of placeholder keys e.g. ["student.display_name","invoice.amount"].';

create unique index comm_message_template_versions_current_unique_idx
  on public.comm_message_template_versions (template_id)
  where is_current = true;

create index comm_message_template_versions_template_idx
  on public.comm_message_template_versions (template_id, version desc);

alter table public.comm_message_template_versions enable row level security;
revoke all on public.comm_message_template_versions from anon;
grant select, insert, update on public.comm_message_template_versions to authenticated;

create policy comm_message_template_versions_own on public.comm_message_template_versions
  for all to authenticated
  using (
    template_id in (
      select id from public.comm_message_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.comm_message_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Delivery rules (config — no queue)
-- ---------------------------------------------------------------------------

create table public.comm_delivery_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  event_code text,
  channels jsonb not null default '[]'::jsonb,
  priority_id uuid references public.comm_priority_levels (id) on delete set null,
  audience_group_id uuid references public.comm_audience_groups (id) on delete set null,
  template_id uuid references public.comm_message_templates (id) on delete set null,
  category_id uuid references public.comm_announcement_categories (id) on delete set null,
  respect_quiet_hours boolean not null default true,
  require_consent boolean not null default true,
  is_enabled boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_delivery_rules is
  'E18 delivery rule config (event → channels/audience/template). Does not send.';
comment on column public.comm_delivery_rules.channels is
  'JSON array of channel codes: email, whatsapp, sms, notification, in_app.';

create unique index comm_delivery_rules_school_active_code_unique_idx
  on public.comm_delivery_rules (school_id, lower(code))
  where archived_at is null;

create index comm_delivery_rules_event_idx
  on public.comm_delivery_rules (school_id, event_code)
  where archived_at is null and is_enabled = true;

alter table public.comm_delivery_rules enable row level security;
revoke all on public.comm_delivery_rules from anon;
grant select, insert, update on public.comm_delivery_rules to authenticated;

create policy comm_delivery_rules_own on public.comm_delivery_rules
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Approval rules
-- ---------------------------------------------------------------------------

create table public.comm_approval_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  require_approval boolean not null default true,
  min_priority_id uuid references public.comm_priority_levels (id) on delete set null,
  category_id uuid references public.comm_announcement_categories (id) on delete set null,
  audience_group_id uuid references public.comm_audience_groups (id) on delete set null,
  approver_roles jsonb not null default '["school_admin"]'::jsonb,
  is_enabled boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_approval_rules is
  'E18 approval gates for announcements/campaigns. Workflow runtime future.';

create unique index comm_approval_rules_school_active_code_unique_idx
  on public.comm_approval_rules (school_id, lower(code))
  where archived_at is null;

alter table public.comm_approval_rules enable row level security;
revoke all on public.comm_approval_rules from anon;
grant select, insert, update on public.comm_approval_rules to authenticated;

create policy comm_approval_rules_own on public.comm_approval_rules
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. FUTURE stubs: automations + campaigns (config shell only)
-- ---------------------------------------------------------------------------

create table public.comm_automations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  trigger_event text,
  delivery_rule_id uuid references public.comm_delivery_rules (id) on delete set null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_automations is
  'FUTURE E18 automation definitions. Not executed by app yet.';

create unique index comm_automations_school_active_code_unique_idx
  on public.comm_automations (school_id, lower(code))
  where archived_at is null;

alter table public.comm_automations enable row level security;
revoke all on public.comm_automations from anon;
grant select, insert, update on public.comm_automations to authenticated;

create policy comm_automations_own on public.comm_automations
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create table public.comm_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  audience_group_id uuid references public.comm_audience_groups (id) on delete set null,
  template_id uuid references public.comm_message_templates (id) on delete set null,
  scheduled_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'scheduled', 'running', 'completed', 'cancelled'))
);

comment on table public.comm_campaigns is
  'FUTURE E18 campaign shells. No sending in this migration.';

create unique index comm_campaigns_school_active_code_unique_idx
  on public.comm_campaigns (school_id, lower(code))
  where archived_at is null;

alter table public.comm_campaigns enable row level security;
revoke all on public.comm_campaigns from anon;
grant select, insert, update on public.comm_campaigns to authenticated;

create policy comm_campaigns_own on public.comm_campaigns
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 9. Seed defaults
-- ---------------------------------------------------------------------------

insert into public.comm_priority_levels (
  school_id, code, name, description, rank, bypass_quiet_hours, display_order
)
select s.id, p.code, p.name, p.description, p.rank, p.bypass, p.ord
from public.schools s
cross join (
  values
    ('critical', 'Critical', 'Security / safety — bypass quiet hours', 100, true, 1),
    ('high', 'High', 'Transactional alerts', 75, true, 2),
    ('normal', 'Normal', 'Standard announcements', 50, false, 3),
    ('low', 'Low', 'Digests / FYI', 25, false, 4)
) as p(code, name, description, rank, bypass, ord)
where not exists (
  select 1 from public.comm_priority_levels x
  where x.school_id = s.id and lower(x.code) = lower(p.code)
);

insert into public.comm_announcement_categories (
  school_id, code, name, description, display_order
)
select s.id, c.code, c.name, c.description, c.ord
from public.schools s
cross join (
  values
    ('GENERAL', 'General', 'General school announcements', 1),
    ('ACADEMIC', 'Academic', 'Academic / exam notices', 2),
    ('FEE', 'Fees', 'Fee and payment notices', 3),
    ('ATTENDANCE', 'Attendance', 'Attendance alerts', 4),
    ('EVENTS', 'Events', 'Events and PTM', 5),
    ('EMERGENCY', 'Emergency', 'Urgent / safety', 6)
) as c(code, name, description, ord)
where not exists (
  select 1 from public.comm_announcement_categories x
  where x.school_id = s.id and lower(x.code) = lower(c.code)
);

insert into public.comm_audience_groups (
  school_id, code, name, description, filter_rules, display_order
)
select s.id, g.code, g.name, g.description, g.filters::jsonb, g.ord
from public.schools s
cross join (
  values
    ('ALL-PARENTS', 'All parents', 'All linked parents', '{"roles":["parent"],"include_parents":true}', 1),
    ('ALL-STAFF', 'All staff', 'Active staff', '{"roles":["teacher","staff"],"include_staff":true}', 2),
    ('ALL-STUDENTS', 'All students', 'Active students', '{"roles":["student"],"include_students":true}', 3),
    ('WHOLE-SCHOOL', 'Whole school', 'Parents + staff + students', '{"include_parents":true,"include_staff":true,"include_students":true}', 4)
) as g(code, name, description, filters, ord)
where not exists (
  select 1 from public.comm_audience_groups x
  where x.school_id = s.id and lower(x.code) = lower(g.code)
);
