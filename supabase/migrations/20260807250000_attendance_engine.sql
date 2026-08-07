-- Phase 2: Attendance Engine (E12)
-- Enriches attendance_records; adds sessions, leave requests, audit log.

-- ---------------------------------------------------------------------------
-- 1. Sessions (bulk day / future period batch)
-- ---------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete restrict,
  attendance_date date not null,
  scope text not null default 'daily'
    check (scope in ('daily', 'period')),
  period_definition_id uuid references public.period_definitions (id) on delete set null,
  workflow_status text not null default 'draft'
    check (
      workflow_status in ('draft', 'submitted', 'approved', 'locked')
    ),
  taken_by_employment_id uuid references public.teacher_employments (id) on delete set null,
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    scope = 'daily' and period_definition_id is null
    or scope = 'period' and period_definition_id is not null
  )
);

comment on table public.attendance_sessions is
  'E12 bulk attendance container for a section+date (+ optional period). Lock/approve gate teacher edits.';

create unique index attendance_sessions_unique_idx
  on public.attendance_sessions (
    section_id,
    attendance_date,
    coalesce(period_definition_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, attendance_date);

create index attendance_sessions_workflow_idx
  on public.attendance_sessions (school_id, workflow_status);

alter table public.attendance_sessions enable row level security;
revoke all on public.attendance_sessions from anon;
grant select, insert, update on public.attendance_sessions to authenticated;

create policy attendance_sessions_own on public.attendance_sessions
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Enrich attendance_records
-- ---------------------------------------------------------------------------

alter table public.attendance_records
  add column if not exists session_id uuid references public.attendance_sessions (id) on delete set null,
  add column if not exists scope text not null default 'daily',
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists leave_type text,
  add column if not exists late_minutes integer,
  add column if not exists recorded_by_employment_id uuid references public.teacher_employments (id) on delete set null,
  add column if not exists visible_to_guardians boolean not null default false,
  add column if not exists visible_to_students boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists correction_of_id uuid references public.attendance_records (id) on delete set null,
  add column if not exists is_correction boolean not null default false,
  add column if not exists superseded_at timestamptz;

alter table public.attendance_records
  drop constraint if exists attendance_records_status_check;

alter table public.attendance_records
  add constraint attendance_records_status_check
  check (
    status in (
      'present',
      'absent',
      'late',
      'half_day',
      'excused',
      'leave'
    )
  );

alter table public.attendance_records
  drop constraint if exists attendance_records_scope_check;

alter table public.attendance_records
  add constraint attendance_records_scope_check
  check (scope in ('daily', 'period'));

alter table public.attendance_records
  drop constraint if exists attendance_records_workflow_status_check;

alter table public.attendance_records
  add constraint attendance_records_workflow_status_check
  check (
    workflow_status in ('draft', 'submitted', 'approved', 'locked')
  );

alter table public.attendance_records
  drop constraint if exists attendance_records_late_minutes_check;

alter table public.attendance_records
  add constraint attendance_records_late_minutes_check
  check (late_minutes is null or late_minutes >= 0);

comment on column public.attendance_records.visible_to_guardians is
  'Set true on approve/lock so parents see facts automatically.';
comment on column public.attendance_records.visible_to_students is
  'Set true on approve/lock so students see facts automatically.';
comment on column public.attendance_records.scope is
  'daily = default; period = FUTURE period attendance (period_definition_id required).';

create index attendance_records_session_idx
  on public.attendance_records (session_id)
  where session_id is not null;

create index attendance_records_visible_student_idx
  on public.attendance_records (student_profile_id, attendance_date desc)
  where visible_to_guardians = true or visible_to_students = true;

create index attendance_records_workflow_idx
  on public.attendance_records (school_id, workflow_status, attendance_date);

-- Prefer active (non-superseded) unique for daily/period marks
drop index if exists public.attendance_records_daily_unique_idx;

create unique index attendance_records_active_unique_idx
  on public.attendance_records (
    student_profile_id,
    attendance_date,
    coalesce(period_definition_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where superseded_at is null and is_correction = false;

-- ---------------------------------------------------------------------------
-- 3. Leave requests
-- ---------------------------------------------------------------------------

create table public.attendance_leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  leave_type text not null default 'general',
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

comment on table public.attendance_leave_requests is
  'E12 leave applications. Approved leave materializes attendance_records with status=leave.';

create index attendance_leave_requests_student_idx
  on public.attendance_leave_requests (student_profile_id, start_date)
  where archived_at is null;

create index attendance_leave_requests_status_idx
  on public.attendance_leave_requests (school_id, status)
  where archived_at is null;

alter table public.attendance_leave_requests enable row level security;
revoke all on public.attendance_leave_requests from anon;
grant select, insert, update on public.attendance_leave_requests to authenticated;

create policy attendance_leave_requests_own on public.attendance_leave_requests
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Attendance audit log
-- ---------------------------------------------------------------------------

create table public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete set null,
  record_id uuid references public.attendance_records (id) on delete set null,
  leave_request_id uuid references public.attendance_leave_requests (id) on delete set null,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  employment_id uuid references public.teacher_employments (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.attendance_audit_log is
  'E12 attendance audit trail. Complements E28 audit_entries for ops detail.';

create index attendance_audit_log_school_created_idx
  on public.attendance_audit_log (school_id, created_at desc);

create index attendance_audit_log_session_idx
  on public.attendance_audit_log (session_id, created_at desc)
  where session_id is not null;

create index attendance_audit_log_record_idx
  on public.attendance_audit_log (record_id, created_at desc)
  where record_id is not null;

alter table public.attendance_audit_log enable row level security;
revoke all on public.attendance_audit_log from anon;
grant select, insert on public.attendance_audit_log to authenticated;
-- append-only

create policy attendance_audit_log_own on public.attendance_audit_log
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
