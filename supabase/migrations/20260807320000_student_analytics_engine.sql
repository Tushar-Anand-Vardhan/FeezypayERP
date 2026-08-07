-- Phase 2: Student Analytics Engine (E22 — student slice)
-- Deterministic aggregates + optional snapshot mart. Never writes OLTP fact tables.

create table public.student_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete restrict,
  academic_year_id uuid not null
    references public.academic_years (id) on delete restrict,
  generator_version text not null default '1.0.0',
  generated_at timestamptz not null default now(),
  aggregates jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  progress_graphs jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.student_analytics_snapshots is
  'E22 student analytics mart — deterministic regenerate-from-OLTP snapshots. Not a second SoT.';

comment on column public.student_analytics_snapshots.aggregates is
  'Attendance, assessment, subject trends, participation, behaviour, achievements, remarks summaries.';

comment on column public.student_analytics_snapshots.insights is
  'Deterministic strengths, weaknesses, risk indicators (no AI).';

comment on column public.student_analytics_snapshots.progress_graphs is
  'Series points for attendance / assessment / subject progress charts.';

create index student_analytics_snapshots_student_idx
  on public.student_analytics_snapshots (
    school_id,
    student_profile_id,
    academic_year_id,
    generated_at desc
  )
  where archived_at is null;

create index student_analytics_snapshots_year_idx
  on public.student_analytics_snapshots (school_id, academic_year_id, generated_at desc)
  where archived_at is null;

alter table public.student_analytics_snapshots enable row level security;
revoke all on public.student_analytics_snapshots from anon;
grant select, insert, update on public.student_analytics_snapshots to authenticated;

create policy student_analytics_snapshots_own on public.student_analytics_snapshots
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create table public.student_analytics_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  snapshot_id uuid
    references public.student_analytics_snapshots (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index student_analytics_audit_school_idx
  on public.student_analytics_audit_log (school_id, created_at desc);

alter table public.student_analytics_audit_log enable row level security;
revoke all on public.student_analytics_audit_log from anon;
grant select, insert on public.student_analytics_audit_log to authenticated;

create policy student_analytics_audit_select on public.student_analytics_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy student_analytics_audit_insert on public.student_analytics_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
