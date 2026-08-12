-- Wave 5: dated exam sitting windows, section-aware uniqueness, rubrics.

-- Sitting window + day kind + optional period
alter table public.exam_subject_schedules
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists day_kind text,
  add column if not exists period_id uuid references public.period_definitions (id) on delete set null,
  add column if not exists rubric_id uuid;

alter table public.exam_subject_schedules
  drop constraint if exists exam_subject_schedules_day_kind_chk;

alter table public.exam_subject_schedules
  add constraint exam_subject_schedules_day_kind_chk
  check (day_kind is null or day_kind in ('half_day', 'full_day'));

comment on column public.exam_subject_schedules.starts_at is
  'Exam sitting start (UTC). Prefer over scheduled_at when set.';
comment on column public.exam_subject_schedules.ends_at is
  'Exam sitting end (UTC).';
comment on column public.exam_subject_schedules.day_kind is
  'half_day or full_day sitting; optional metadata for calendar display.';
comment on column public.exam_subject_schedules.period_id is
  'Optional timetable period for subject×day×period scheduling.';

-- Backfill starts_at from scheduled_at when missing
update public.exam_subject_schedules
set starts_at = scheduled_at
where starts_at is null and scheduled_at is not null;

-- Section-aware uniqueness (null section = class-wide)
alter table public.exam_subject_schedules
  drop constraint if exists exam_subject_schedules_exam_definition_id_subject_id_class_id_key;

drop index if exists public.exam_subject_schedules_exam_subject_class_unique_idx;

create unique index if not exists exam_subject_schedules_slot_unique_idx
  on public.exam_subject_schedules (
    exam_definition_id,
    subject_id,
    class_id,
    coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

-- Rubrics (multi-criteria beyond grading_type enum)
create table if not exists public.assessment_rubrics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  max_score numeric(8,2),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assessment_rubrics_school_code_uidx
  on public.assessment_rubrics (school_id, lower(code))
  where archived_at is null;

create table if not exists public.assessment_rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.assessment_rubrics (id) on delete cascade,
  name text not null,
  description text,
  max_score numeric(8,2) not null default 1,
  weight numeric(8,2) not null default 1,
  display_order integer not null default 0,
  levels jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.assessment_rubric_criteria.levels is
  'JSON array of { label, score, descriptor } level bands.';

create index if not exists assessment_rubric_criteria_rubric_idx
  on public.assessment_rubric_criteria (rubric_id)
  where archived_at is null;

-- FK from schedules after rubrics exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_subject_schedules_rubric_id_fkey'
  ) then
    alter table public.exam_subject_schedules
      add constraint exam_subject_schedules_rubric_id_fkey
      foreign key (rubric_id) references public.assessment_rubrics (id) on delete set null;
  end if;
end $$;

alter table public.assessment_rubrics enable row level security;
alter table public.assessment_rubric_criteria enable row level security;

revoke all on public.assessment_rubrics from anon;
revoke all on public.assessment_rubric_criteria from anon;
grant select, insert, update on public.assessment_rubrics to authenticated;
grant select, insert, update on public.assessment_rubric_criteria to authenticated;

drop policy if exists assessment_rubrics_own on public.assessment_rubrics;
create policy assessment_rubrics_own on public.assessment_rubrics
  for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

drop policy if exists assessment_rubric_criteria_own on public.assessment_rubric_criteria;
create policy assessment_rubric_criteria_own on public.assessment_rubric_criteria
  for all to authenticated
  using (
    rubric_id in (
      select id from public.assessment_rubrics
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    rubric_id in (
      select id from public.assessment_rubrics
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
