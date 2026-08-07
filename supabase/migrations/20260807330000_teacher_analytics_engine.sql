-- Phase 2: Teacher Analytics Engine (E22 — teacher slice)
-- Deterministic aggregates + optional snapshot mart. Never writes OLTP fact tables.

create table public.teacher_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employment_id uuid not null
    references public.teacher_employments (id) on delete restrict,
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

comment on table public.teacher_analytics_snapshots is
  'E22 teacher analytics mart — deterministic regenerate-from-OLTP snapshots. Not a second SoT.';

comment on column public.teacher_analytics_snapshots.aggregates is
  'Attendance/assessment/homework completion, student performance, workload, classes, department.';

comment on column public.teacher_analytics_snapshots.insights is
  'Deterministic strengths/weaknesses/risks. AI insights FUTURE (E23).';

create index teacher_analytics_snapshots_emp_idx
  on public.teacher_analytics_snapshots (
    school_id,
    employment_id,
    academic_year_id,
    generated_at desc
  )
  where archived_at is null;

create index teacher_analytics_snapshots_year_idx
  on public.teacher_analytics_snapshots (school_id, academic_year_id, generated_at desc)
  where archived_at is null;

alter table public.teacher_analytics_snapshots enable row level security;
revoke all on public.teacher_analytics_snapshots from anon;
grant select, insert, update on public.teacher_analytics_snapshots to authenticated;

create policy teacher_analytics_snapshots_own on public.teacher_analytics_snapshots
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create table public.teacher_analytics_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  employment_id uuid references public.teacher_employments (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  snapshot_id uuid
    references public.teacher_analytics_snapshots (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index teacher_analytics_audit_school_idx
  on public.teacher_analytics_audit_log (school_id, created_at desc);

alter table public.teacher_analytics_audit_log enable row level security;
revoke all on public.teacher_analytics_audit_log from anon;
grant select, insert on public.teacher_analytics_audit_log to authenticated;

create policy teacher_analytics_audit_select on public.teacher_analytics_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy teacher_analytics_audit_insert on public.teacher_analytics_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
