-- Teacher profiles + school employments. Migrates school-scoped teachers.

create table public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons (id) on delete restrict,
  global_id text not null unique,
  qualification text,
  years_experience integer check (years_experience is null or years_experience >= 0),
  bio text,
  linkedin_url text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.teacher_profiles_set_global_id()
returns trigger
language plpgsql
as $$
begin
  if new.global_id is null or new.global_id = '' then
    new.global_id := public.next_global_id('TCH', 'public.teacher_global_id_seq');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger teacher_profiles_set_global_id_trg
  before insert or update on public.teacher_profiles
  for each row execute function public.teacher_profiles_set_global_id();

create table public.teacher_employments (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.teacher_profiles (id) on delete restrict,
  school_id uuid not null references public.schools (id) on delete cascade,
  employee_code text,
  designation text,
  department_id uuid references public.departments (id) on delete set null,
  is_hod boolean not null default false,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'guest')),
  joined_on date,
  left_on date,
  status text not null default 'active'
    check (status in ('active', 'ended', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index teacher_employments_active_unique_idx
  on public.teacher_employments (school_id, teacher_profile_id)
  where status = 'active';

create unique index teacher_employments_school_employee_code_unique_idx
  on public.teacher_employments (school_id, lower(employee_code))
  where employee_code is not null;

create index teacher_employments_school_status_idx
  on public.teacher_employments (school_id, status);

create table public.employment_subjects (
  id uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.teacher_employments (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employment_id, subject_id)
);

create table public.teacher_id_map (
  old_teacher_id uuid primary key,
  employment_id uuid not null,
  teacher_profile_id uuid not null,
  person_id uuid not null
);

-- Migrate existing teachers → person + profile + employment (preserve teacher UUID as employment id).
do $$
declare
  t record;
  person_uuid uuid;
  profile_uuid uuid;
begin
  for t in
    select * from public.teachers
  loop
    person_uuid := gen_random_uuid();
    profile_uuid := gen_random_uuid();

    insert into public.persons (id, global_id, full_name, email, phone)
    values (
      person_uuid,
      public.next_global_id('PER', 'public.person_global_id_seq'),
      t.full_name,
      t.email,
      t.phone
    );

    insert into public.teacher_profiles (id, person_id, global_id)
    values (
      profile_uuid,
      person_uuid,
      public.next_global_id('TCH', 'public.teacher_global_id_seq')
    );

    insert into public.teacher_employments (
      id,
      teacher_profile_id,
      school_id,
      employee_code,
      designation,
      department_id,
      is_hod,
      status,
      created_at,
      updated_at
    ) values (
      t.id,
      profile_uuid,
      t.school_id,
      t.employee_code,
      t.designation,
      t.department_id,
      t.is_hod,
      'active',
      t.created_at,
      t.updated_at
    );

    insert into public.teacher_id_map (old_teacher_id, employment_id, teacher_profile_id, person_id)
    values (t.id, t.id, profile_uuid, person_uuid);
  end loop;
end $$;

insert into public.employment_subjects (employment_id, subject_id)
select ts.teacher_id, ts.subject_id
from public.teacher_subjects ts
on conflict do nothing;

-- Repoint FKs: drop old teacher FKs, rename legacy, add FKs to employments.
alter table public.sections drop constraint if exists sections_class_teacher_id_fkey;
alter table public.timetable_slots drop constraint if exists timetable_slots_teacher_id_fkey;
alter table public.teacher_subject_assignments drop constraint if exists teacher_subject_assignments_teacher_id_fkey;

alter table public.teacher_subjects rename to teacher_subjects_legacy;
alter table public.teachers rename to teachers_legacy;

alter table public.sections
  add constraint sections_class_teacher_id_fkey
  foreign key (class_teacher_id) references public.teacher_employments (id) on delete set null;

alter table public.timetable_slots
  add constraint timetable_slots_teacher_id_fkey
  foreign key (teacher_id) references public.teacher_employments (id) on delete set null;

alter table public.teacher_subject_assignments
  add constraint teacher_subject_assignments_teacher_id_fkey
  foreign key (teacher_id) references public.teacher_employments (id) on delete cascade;

alter table public.teacher_profiles enable row level security;
alter table public.teacher_employments enable row level security;
alter table public.employment_subjects enable row level security;

revoke all on public.teacher_profiles from anon;
revoke all on public.teacher_employments from anon;
revoke all on public.employment_subjects from anon;

grant select, insert, update, delete on public.teacher_profiles to authenticated;
grant select, insert, update, delete on public.teacher_employments to authenticated;
grant select, insert, update, delete on public.employment_subjects to authenticated;

create policy teacher_employments_own on public.teacher_employments
  for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy employment_subjects_own on public.employment_subjects
  for all to authenticated
  using (
    employment_id in (
      select id from teacher_employments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    employment_id in (
      select id from teacher_employments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create policy teacher_profiles_via_employment on public.teacher_profiles
  for all to authenticated
  using (
    id in (
      select teacher_profile_id from teacher_employments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (auth.uid() is not null);

-- Tighten persons: school staff can see persons linked via employment.
drop policy if exists persons_authenticated_select on public.persons;
drop policy if exists persons_authenticated_update on public.persons;

create policy persons_select_via_school_link on public.persons
  for select to authenticated
  using (
    id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or auth_user_id = auth.uid()
  );

create policy persons_update_via_school_link on public.persons
  for update to authenticated
  using (
    id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or auth_user_id = auth.uid()
  )
  with check (
    id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or auth_user_id = auth.uid()
  );

-- Keep insert for onboarding (creating new people).
-- Self-read already covered via auth_user_id.
