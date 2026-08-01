-- Step 5 schema: subjects and class applicability.

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  type text not null check (type in ('scholastic', 'co_scholastic')),
  created_at timestamptz not null default now()
);

comment on table public.subjects is
  'School-wide subject catalog entries.';

create unique index subjects_school_name_unique_idx
  on public.subjects (school_id, lower(name));

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  is_elective boolean not null default false,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

comment on table public.class_subjects is
  'Which subjects apply to which classes, with optional elective flag.';

alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;

revoke all on public.subjects from anon;
revoke all on public.class_subjects from anon;

grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.class_subjects to authenticated;

create policy subjects_own
  on public.subjects
  for all
  to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy class_subjects_own
  on public.class_subjects
  for all
  to authenticated
  using (
    class_id in (
      select id from classes where academic_year_id in (
        select id from academic_years where school_id in (
          select school_id from profiles where profiles.id = auth.uid()
        )
      )
    )
    and subject_id in (
      select id from subjects where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  )
  with check (
    class_id in (
      select id from classes where academic_year_id in (
        select id from academic_years where school_id in (
          select school_id from profiles where profiles.id = auth.uid()
        )
      )
    )
    and subject_id in (
      select id from subjects where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  );
