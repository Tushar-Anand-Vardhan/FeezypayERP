-- Exam definitions for onboarding (lightweight scheduling).

create table public.exam_definitions (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  name text not null,
  category text not null
    check (category in ('unit_test', 'quiz', 'midterm', 'final', 'oral', 'project')),
  weightage_percent numeric(5,2),
  max_marks numeric(8,2),
  created_at timestamptz not null default now()
);

create unique index exam_definitions_year_name_unique_idx
  on public.exam_definitions (academic_year_id, lower(name));

create table public.exam_subject_schedules (
  id uuid primary key default gen_random_uuid(),
  exam_definition_id uuid not null references public.exam_definitions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  grading_type text not null default 'marks'
    check (grading_type in ('marks', 'letter_grade', 'rubric')),
  max_marks numeric(8,2),
  created_at timestamptz not null default now(),
  unique (exam_definition_id, subject_id, class_id)
);

alter table public.exam_definitions enable row level security;
alter table public.exam_subject_schedules enable row level security;

revoke all on public.exam_definitions from anon;
revoke all on public.exam_subject_schedules from anon;

grant select, insert, update, delete on public.exam_definitions to authenticated;
grant select, insert, update, delete on public.exam_subject_schedules to authenticated;

create policy exam_definitions_own on public.exam_definitions for all to authenticated
  using (
    academic_year_id in (
      select id from academic_years where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  )
  with check (
    academic_year_id in (
      select id from academic_years where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  );

create policy exam_subject_schedules_own on public.exam_subject_schedules
  for all to authenticated
  using (
    exam_definition_id in (
      select ed.id from exam_definitions ed
      join academic_years ay on ay.id = ed.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    exam_definition_id in (
      select ed.id from exam_definitions ed
      join academic_years ay on ay.id = ed.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
