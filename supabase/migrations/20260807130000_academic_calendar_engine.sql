-- Phase 1: Academic Calendar Engine (E08 + E17 scheduling surface)
-- Years/terms/working days/holidays (E08) + calendar events (E17).
-- Holiday ≠ CalendarEvent. Future: recurrence, attachments, notify, attendance, AI.

-- ---------------------------------------------------------------------------
-- 1. Enrich academic_years
-- ---------------------------------------------------------------------------

alter table public.academic_years
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.academic_years
set status = case when is_active then 'active' else 'closed' end
where status is null or status = 'active';

alter table public.academic_years
  drop constraint if exists academic_years_status_chk;

alter table public.academic_years
  add constraint academic_years_status_chk
  check (status in ('draft', 'active', 'closed'));

alter table public.academic_years
  drop constraint if exists academic_years_dates_chk;

alter table public.academic_years
  add constraint academic_years_dates_chk
  check (
    start_date is null
    or end_date is null
    or end_date >= start_date
  );

comment on column public.academic_years.status is
  'E08 lifecycle: draft | active | closed. Prefer over toggling is_active alone.';
comment on column public.academic_years.archived_at is
  'Soft-retire; do not hard-delete years with operational children.';

create index if not exists academic_years_school_status_idx
  on public.academic_years (school_id, status)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Enrich terms
-- ---------------------------------------------------------------------------

alter table public.terms
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists terms_year_active_idx
  on public.terms (academic_year_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Working day patterns (E08)
-- ---------------------------------------------------------------------------

create table public.school_working_day_patterns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  monday boolean not null default true,
  tuesday boolean not null default true,
  wednesday boolean not null default true,
  thursday boolean not null default true,
  friday boolean not null default true,
  saturday boolean not null default false,
  sunday boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.school_working_day_patterns is
  'E08 which weekdays are instructional. Null academic_year_id = school default.';

-- One default pattern per school (year null)
create unique index school_working_day_patterns_default_unique_idx
  on public.school_working_day_patterns (school_id)
  where academic_year_id is null;

create unique index school_working_day_patterns_year_unique_idx
  on public.school_working_day_patterns (school_id, academic_year_id)
  where academic_year_id is not null;

alter table public.school_working_day_patterns enable row level security;
revoke all on public.school_working_day_patterns from anon;
grant select, insert, update, delete on public.school_working_day_patterns to authenticated;

create policy school_working_day_patterns_own
  on public.school_working_day_patterns
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Holidays (E08) — non-instructional days; not occasions
-- ---------------------------------------------------------------------------

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  is_all_day boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

comment on table public.holidays is
  'E08 non-instructional days. Distinct from calendar_events (E17 occasions).';

create index holidays_school_year_dates_idx
  on public.holidays (school_id, academic_year_id, start_date, end_date)
  where archived_at is null;

alter table public.holidays enable row level security;
revoke all on public.holidays from anon;
grant select, insert, update on public.holidays to authenticated;
-- no delete — archive only

create policy holidays_own
  on public.holidays
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Calendar events (E17) — PTM, competitions, sports, trips, etc.
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  term_id uuid references public.terms (id) on delete set null,
  title text not null,
  description text,
  category text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  location text,
  visibility text not null default 'school',
  audience jsonb not null default '{}'::jsonb,
  approval_status text not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  -- Future columns (nullable stubs)
  recurrence_rule text,
  attachment_media_ids uuid[] not null default '{}',
  notify_on_publish boolean not null default true,
  attendance_required boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (
    category in (
      'ptm',
      'competition',
      'sports',
      'trip',
      'assembly',
      'workshop',
      'teacher_meeting',
      'annual_day',
      'custom'
    )
  ),
  check (
    visibility in (
      'school',
      'staff',
      'students',
      'parents',
      'custom'
    )
  ),
  check (
    approval_status in (
      'draft',
      'pending',
      'approved',
      'rejected',
      'published',
      'cancelled',
      'completed'
    )
  )
);

comment on table public.calendar_events is
  'E17 school occasions (PTM, sports, trips…). Not holidays (E08) and not timetable slots.';
comment on column public.calendar_events.audience is
  'JSON: { class_ids?: uuid[], section_ids?: uuid[], role_keys?: string[] }';
comment on column public.calendar_events.recurrence_rule is
  'Future RRULE; unused in v1.';
comment on column public.calendar_events.attachment_media_ids is
  'Future E27 media refs.';
comment on column public.calendar_events.notify_on_publish is
  'When true, publish should enqueue E18/E19 (future).';
comment on column public.calendar_events.attendance_required is
  'Future E12 event attendance.';

create index calendar_events_school_starts_idx
  on public.calendar_events (school_id, starts_at)
  where archived_at is null;

create index calendar_events_year_category_idx
  on public.calendar_events (academic_year_id, category)
  where archived_at is null;

create index calendar_events_approval_idx
  on public.calendar_events (school_id, approval_status)
  where archived_at is null;

create index calendar_events_term_idx
  on public.calendar_events (term_id)
  where term_id is not null and archived_at is null;

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from anon;
grant select, insert, update on public.calendar_events to authenticated;

create policy calendar_events_own
  on public.calendar_events
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- Soft-archive years: prefer UPDATE; keep DELETE for empty drafts only via app
revoke delete on public.academic_years from authenticated;
grant select, insert, update on public.academic_years to authenticated;
