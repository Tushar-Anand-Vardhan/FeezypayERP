-- Timetable structure and teacher-subject-section assignments.

alter table public.sections
  add column if not exists class_teacher_id uuid references public.teachers (id) on delete set null;

create table public.period_definitions (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  period_number integer not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (academic_year_id, period_number),
  check (period_number > 0),
  check (end_time > start_time)
);

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  period_definition_id uuid not null references public.period_definitions (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (section_id, day_of_week, period_definition_id)
);

create table public.teacher_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (section_id, subject_id, teacher_id)
);

alter table public.period_definitions enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.teacher_subject_assignments enable row level security;

revoke all on public.period_definitions from anon;
revoke all on public.timetable_slots from anon;
revoke all on public.teacher_subject_assignments from anon;

grant select, insert, update, delete on public.period_definitions to authenticated;
grant select, insert, update, delete on public.timetable_slots to authenticated;
grant select, insert, update, delete on public.teacher_subject_assignments to authenticated;

create policy period_definitions_own on public.period_definitions for all to authenticated
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

create policy timetable_slots_own on public.timetable_slots for all to authenticated
  using (
    section_id in (
      select s.id from sections s
      join classes c on c.id = s.class_id
      join academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    section_id in (
      select s.id from sections s
      join classes c on c.id = s.class_id
      join academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create policy teacher_subject_assignments_own on public.teacher_subject_assignments
  for all to authenticated
  using (
    section_id in (
      select s.id from sections s
      join classes c on c.id = s.class_id
      join academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    section_id in (
      select s.id from sections s
      join classes c on c.id = s.class_id
      join academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
