-- Phase 2: Teacher Workspace — SCHEMA-READY homework only.
-- Other panels read existing timetable / attendance / exams / calendar / dept announcements.

create table public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employment_id uuid not null references public.teacher_employments (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete restrict,
  subject_id uuid references public.subjects (id) on delete set null,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  title text not null,
  description text,
  assigned_on date not null default current_date,
  due_on date,
  status text not null default 'assigned'
    check (status in ('draft', 'assigned', 'closed')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_on is null or due_on >= assigned_on)
);

comment on table public.homework_assignments is
  'Teacher Workspace homework panel. SCHEMA-READY until homework UI; no hardcoded rows.';

create index homework_assignments_employment_idx
  on public.homework_assignments (employment_id, due_on)
  where archived_at is null;

create index homework_assignments_section_idx
  on public.homework_assignments (section_id, due_on)
  where archived_at is null;

alter table public.homework_assignments enable row level security;
revoke all on public.homework_assignments from anon;
grant select, insert, update on public.homework_assignments to authenticated;

create policy homework_assignments_own on public.homework_assignments
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
