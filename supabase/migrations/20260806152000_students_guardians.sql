-- Students, guardians, and section enrollments.

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  admission_number text not null,
  photo_path text,
  house_id uuid references public.houses (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'withdrawn', 'alumni')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index students_school_admission_unique_idx
  on public.students (school_id, lower(admission_number));

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  phone text,
  whatsapp_number text,
  email text,
  whatsapp_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id, guardian_id)
);

create table public.student_section_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete restrict,
  enrolled_on date not null default current_date,
  left_on date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'transferred', 'withdrawn')),
  enrollment_type text not null default 'new_admission'
    check (enrollment_type in ('new_admission', 'promoted', 'repeated', 'transferred')),
  created_at timestamptz not null default now()
);

create index student_section_enrollments_active_idx
  on public.student_section_enrollments (student_id)
  where status = 'active' and left_on is null;

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_section_enrollments enable row level security;

revoke all on public.students from anon;
revoke all on public.guardians from anon;
revoke all on public.student_guardians from anon;
revoke all on public.student_section_enrollments from anon;

grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.guardians to authenticated;
grant select, insert, update, delete on public.student_guardians to authenticated;
grant select, insert, update, delete on public.student_section_enrollments to authenticated;

create policy students_own on public.students for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy guardians_own on public.guardians for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy student_guardians_own on public.student_guardians for all to authenticated
  using (
    student_id in (
      select id from students where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  )
  with check (
    student_id in (
      select id from students where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  );

create policy student_section_enrollments_own on public.student_section_enrollments
  for all to authenticated
  using (
    student_id in (
      select id from students where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  )
  with check (
    student_id in (
      select id from students where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  );
