-- Phase 2: Communication Operations (E18) + Notification pipe (E19 minimal)
-- Compose messages; enqueue deliveries via Notification Engine tables.
-- Provider adapters (email/WhatsApp/SMS) remain stubbed — in_app delivers immediately.

-- ---------------------------------------------------------------------------
-- 1. E18 — Operational messages
-- ---------------------------------------------------------------------------

create table public.comm_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  message_kind text not null
    check (
      message_kind in (
        'announcement',
        'circular',
        'department',
        'teacher',
        'class',
        'parent_notice',
        'student_notice'
      )
    ),
  title text not null,
  body text not null,
  category_id uuid references public.comm_announcement_categories (id) on delete set null,
  priority_id uuid references public.comm_priority_levels (id) on delete set null,
  audience_group_id uuid references public.comm_audience_groups (id) on delete set null,
  template_id uuid references public.comm_message_templates (id) on delete set null,
  template_version_id uuid
    references public.comm_message_template_versions (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  department_announcement_id uuid
    references public.department_announcements (id) on delete set null,
  -- Explicit targeting (merged with audience group filters at publish)
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'scheduled',
        'published',
        'cancelled',
        'archived'
      )
    ),
  scheduled_for timestamptz,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  attachment_media_ids uuid[] not null default '{}'::uuid[],
  channels text[] not null default array['in_app']::text[],
  notification_type_code text not null default 'communication.announcement',
  created_by uuid references auth.users (id) on delete set null,
  created_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.comm_messages is
  'E18 operational messages (announcements, circulars, class/dept/teacher notices). Delivery via E19.';

comment on column public.comm_messages.audience is
  'JSON targeting: roles[], class_ids[], section_ids[], student_profile_ids[], parent_profile_ids[], employment_ids[], include_parents, include_students, include_staff.';

create index comm_messages_school_status_idx
  on public.comm_messages (school_id, status, created_at desc)
  where archived_at is null;

create index comm_messages_scheduled_idx
  on public.comm_messages (school_id, scheduled_for)
  where status = 'scheduled' and archived_at is null;

create index comm_messages_kind_idx
  on public.comm_messages (school_id, message_kind, academic_year_id)
  where archived_at is null;

alter table public.comm_messages enable row level security;
revoke all on public.comm_messages from anon;
grant select, insert, update on public.comm_messages to authenticated;

create policy comm_messages_own on public.comm_messages
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. E18 audit
-- ---------------------------------------------------------------------------

create table public.comm_message_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  message_id uuid references public.comm_messages (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index comm_message_audit_school_idx
  on public.comm_message_audit_log (school_id, created_at desc);

alter table public.comm_message_audit_log enable row level security;
revoke all on public.comm_message_audit_log from anon;
grant select, insert on public.comm_message_audit_log to authenticated;

create policy comm_message_audit_select on public.comm_message_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy comm_message_audit_insert on public.comm_message_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. E19 — Notification type catalog (seed)
-- ---------------------------------------------------------------------------

create table public.notification_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  default_channels text[] not null default array['in_app']::text[],
  default_priority text not null default 'normal',
  consent_category text not null default 'transactional'
    check (consent_category in ('transactional', 'marketing')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.notification_types is
  'E19 notification type catalog (Phase 0.5 design). Domains request by code.';

insert into public.notification_types (code, name, default_channels, default_priority)
values
  ('communication.announcement', 'School announcement', array['in_app','email'], 'normal'),
  ('communication.circular', 'Circular', array['in_app','email'], 'normal'),
  ('communication.department', 'Department message', array['in_app'], 'normal'),
  ('communication.teacher', 'Teacher message', array['in_app'], 'normal'),
  ('communication.class', 'Class message', array['in_app'], 'normal'),
  ('communication.parent_notice', 'Parent notification', array['in_app','email'], 'normal'),
  ('communication.student_notice', 'Student notification', array['in_app'], 'normal'),
  ('engagement.event_published', 'Event published', array['in_app'], 'normal'),
  ('conduct.incident', 'Conduct incident', array['in_app','email'], 'high'),
  ('assessment.results_published', 'Results published', array['in_app'], 'high'),
  ('document.ready', 'Document ready', array['in_app','email'], 'normal')
on conflict (code) do nothing;

alter table public.notification_types enable row level security;
revoke all on public.notification_types from anon;
grant select on public.notification_types to authenticated;

create policy notification_types_read on public.notification_types
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4. E19 — Delivery requests + attempts + outbox
-- ---------------------------------------------------------------------------

create table public.notification_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  notification_type_code text not null
    references public.notification_types (code) on delete restrict,
  message_id uuid references public.comm_messages (id) on delete set null,
  channel text not null
    check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'push')),
  -- Recipient pointers (exactly one primary target expected)
  recipient_auth_user_id uuid references auth.users (id) on delete set null,
  recipient_person_id uuid references public.persons (id) on delete set null,
  recipient_student_profile_id uuid
    references public.student_profiles (id) on delete set null,
  recipient_parent_profile_id uuid
    references public.parent_profiles (id) on delete set null,
  recipient_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (
      status in (
        'queued',
        'scheduled',
        'sending',
        'sent',
        'failed',
        'read',
        'cancelled'
      )
    ),
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_delivery_requests is
  'E19 DeliveryRequest — one intended send (message × recipient × channel).';

create unique index notification_delivery_idempotency_idx
  on public.notification_delivery_requests (school_id, idempotency_key)
  where idempotency_key is not null;

create index notification_delivery_recipient_user_idx
  on public.notification_delivery_requests (recipient_auth_user_id, created_at desc)
  where recipient_auth_user_id is not null;

create index notification_delivery_student_idx
  on public.notification_delivery_requests (recipient_student_profile_id, created_at desc)
  where recipient_student_profile_id is not null;

create index notification_delivery_message_idx
  on public.notification_delivery_requests (message_id)
  where message_id is not null;

create index notification_delivery_status_idx
  on public.notification_delivery_requests (school_id, status, scheduled_for);

alter table public.notification_delivery_requests enable row level security;
revoke all on public.notification_delivery_requests from anon;
grant select, insert, update on public.notification_delivery_requests to authenticated;

create policy notification_delivery_own on public.notification_delivery_requests
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
    or recipient_auth_user_id = auth.uid()
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create table public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  delivery_request_id uuid not null
    references public.notification_delivery_requests (id) on delete cascade,
  attempt_number integer not null default 1,
  channel text not null,
  provider text not null default 'stub',
  status text not null
    check (status in ('succeeded', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

comment on table public.notification_delivery_attempts is
  'E19 DeliveryAttempt — one try against a channel adapter (stub until providers wired).';

create index notification_attempts_request_idx
  on public.notification_delivery_attempts (delivery_request_id, attempt_number);

alter table public.notification_delivery_attempts enable row level security;
revoke all on public.notification_delivery_attempts from anon;
grant select, insert on public.notification_delivery_attempts to authenticated;

create policy notification_attempts_own on public.notification_delivery_attempts
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  delivery_request_id uuid not null
    references public.notification_delivery_requests (id) on delete cascade,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  locked_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

comment on table public.notification_outbox is
  'E19 transactional outbox for delivery workers. Process sync in-process until dedicated workers ship.';

create index notification_outbox_pending_idx
  on public.notification_outbox (available_at)
  where processed_at is null;

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon;
grant select, insert, update on public.notification_outbox to authenticated;

create policy notification_outbox_own on public.notification_outbox
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
