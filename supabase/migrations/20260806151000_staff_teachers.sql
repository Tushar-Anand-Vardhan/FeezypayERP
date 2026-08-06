-- Staff / teachers master for onboarding.

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index departments_school_name_unique_idx
  on public.departments (school_id, lower(name));

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  employee_code text,
  designation text,
  department_id uuid references public.departments (id) on delete set null,
  is_hod boolean not null default false,
  auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index teachers_school_email_unique_idx
  on public.teachers (school_id, lower(email))
  where email is not null;

create unique index teachers_school_employee_code_unique_idx
  on public.teachers (school_id, lower(employee_code))
  where employee_code is not null;

create table public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id)
);

alter table public.departments enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_subjects enable row level security;

revoke all on public.departments from anon;
revoke all on public.teachers from anon;
revoke all on public.teacher_subjects from anon;

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.teacher_subjects to authenticated;

create policy departments_own on public.departments for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy teachers_own on public.teachers for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy teacher_subjects_own on public.teacher_subjects for all to authenticated
  using (
    teacher_id in (
      select id from teachers where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  )
  with check (
    teacher_id in (
      select id from teachers where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
    and subject_id in (
      select id from subjects where school_id in (
        select school_id from profiles where profiles.id = auth.uid()
      )
    )
  );
