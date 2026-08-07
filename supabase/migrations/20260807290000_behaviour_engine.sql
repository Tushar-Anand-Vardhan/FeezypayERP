-- Phase 2: Behaviour Engine (E13)
-- Enrich conduct_incidents; follow-ups; audit. Timestamped remarks; year filter; analytics derived.

-- ---------------------------------------------------------------------------
-- 1. Enrich conduct_incidents
-- ---------------------------------------------------------------------------

alter table public.conduct_incidents
  add column if not exists remark_kind text not null default 'disciplinary',
  add column if not exists visibility text not null default 'staff',
  add column if not exists body text,
  add column if not exists recorded_at timestamptz not null default now(),
  add column if not exists recorded_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists student_academic_year_id uuid
    references public.student_academic_years (id) on delete set null,
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists section_id uuid references public.sections (id) on delete set null,
  add column if not exists follow_up_required boolean not null default false,
  add column if not exists follow_up_status text not null default 'none',
  add column if not exists visible_to_guardians boolean not null default false,
  add column if not exists visible_to_students boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists correction_of_id uuid
    references public.conduct_incidents (id) on delete set null,
  add column if not exists is_correction boolean not null default false,
  add column if not exists superseded_at timestamptz,
  add column if not exists attachment_media_ids uuid[] not null default '{}'::uuid[];

-- Backfill body from description where empty
update public.conduct_incidents
set body = description
where body is null and description is not null;

update public.conduct_incidents
set recorded_at = coalesce(created_at, now())
where recorded_at is null;

alter table public.conduct_incidents
  drop constraint if exists conduct_incidents_remark_kind_check;

alter table public.conduct_incidents
  add constraint conduct_incidents_remark_kind_check
  check (
    remark_kind in (
      'positive',
      'disciplinary',
      'warning',
      'commendation',
      'teacher_note'
    )
  );

alter table public.conduct_incidents
  drop constraint if exists conduct_incidents_visibility_check;

alter table public.conduct_incidents
  add constraint conduct_incidents_visibility_check
  check (
    visibility in (
      'private',
      'staff',
      'parent_visible',
      'school'
    )
  );

alter table public.conduct_incidents
  drop constraint if exists conduct_incidents_follow_up_status_check;

alter table public.conduct_incidents
  add constraint conduct_incidents_follow_up_status_check
  check (
    follow_up_status in (
      'none',
      'pending',
      'in_progress',
      'completed',
      'cancelled'
    )
  );

-- Expand category check for common behaviour categories
alter table public.conduct_incidents
  drop constraint if exists conduct_incidents_category_check;

-- category stays free-text with soft validation in app; optional check for known values
-- (keep flexible for school policy categories)

comment on table public.conduct_incidents is
  'E13 behaviour remarks / incidents. Timestamped; year-scoped; profile reads by FK — no student blob dump.';

comment on column public.conduct_incidents.remark_kind is
  'positive | disciplinary | warning | commendation | teacher_note';

comment on column public.conduct_incidents.visibility is
  'private (recorder+admin) | staff | parent_visible | school. Synced to visible_to_* flags.';

comment on column public.conduct_incidents.recorded_at is
  'Authoritative timestamp for the remark (defaults to create time).';

create index if not exists conduct_incidents_year_idx
  on public.conduct_incidents (school_id, academic_year_id, recorded_at desc)
  where archived_at is null and superseded_at is null;

create index if not exists conduct_incidents_kind_idx
  on public.conduct_incidents (school_id, remark_kind, academic_year_id)
  where archived_at is null and superseded_at is null;

create index if not exists conduct_incidents_visibility_idx
  on public.conduct_incidents (student_profile_id, academic_year_id)
  where visible_to_guardians or visible_to_students;

-- ---------------------------------------------------------------------------
-- 2. Follow-up actions
-- ---------------------------------------------------------------------------

create table public.behaviour_follow_ups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  conduct_incident_id uuid not null
    references public.conduct_incidents (id) on delete cascade,
  action_type text not null default 'note'
    check (
      action_type in (
        'note',
        'meeting',
        'parent_call',
        'counseling',
        'detention',
        'suspension_referral',
        'commendation_followup',
        'other'
      )
    ),
  title text not null,
  description text,
  due_on date,
  completed_at timestamptz,
  status text not null default 'pending'
    check (
      status in ('pending', 'in_progress', 'completed', 'cancelled')
    ),
  assigned_to_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.behaviour_follow_ups is
  'E13 follow-up actions linked to a behaviour remark/incident. Timestamped.';

create index behaviour_follow_ups_incident_idx
  on public.behaviour_follow_ups (conduct_incident_id)
  where archived_at is null;

create index behaviour_follow_ups_status_idx
  on public.behaviour_follow_ups (school_id, status, due_on)
  where archived_at is null;

alter table public.behaviour_follow_ups enable row level security;
revoke all on public.behaviour_follow_ups from anon;
grant select, insert, update on public.behaviour_follow_ups to authenticated;

create policy behaviour_follow_ups_own on public.behaviour_follow_ups
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Audit log
-- ---------------------------------------------------------------------------

create table public.behaviour_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  conduct_incident_id uuid
    references public.conduct_incidents (id) on delete set null,
  follow_up_id uuid
    references public.behaviour_follow_ups (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

comment on table public.behaviour_audit_log is
  'E13 append-only audit for behaviour remarks, visibility, follow-ups.';

create index behaviour_audit_school_idx
  on public.behaviour_audit_log (school_id, created_at desc);

alter table public.behaviour_audit_log enable row level security;
revoke all on public.behaviour_audit_log from anon;
grant select, insert on public.behaviour_audit_log to authenticated;

create policy behaviour_audit_select on public.behaviour_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy behaviour_audit_insert on public.behaviour_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
