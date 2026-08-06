-- Student profiles, admissions, academic years, parents. Migrates school-scoped students.

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons (id) on delete restrict,
  global_id text not null unique,
  blood_group text,
  medical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.student_profiles_set_global_id()
returns trigger
language plpgsql
as $$
begin
  if new.global_id is null or new.global_id = '' then
    new.global_id := public.next_global_id('STD', 'public.student_global_id_seq');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_profiles_set_global_id_trg
  before insert or update on public.student_profiles
  for each row execute function public.student_profiles_set_global_id();

create table public.student_admissions (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  school_id uuid not null references public.schools (id) on delete cascade,
  admission_number text not null,
  admitted_on date not null default current_date,
  exited_on date,
  status text not null default 'active'
    check (status in ('active', 'withdrawn', 'alumni', 'transferred')),
  house_id uuid references public.houses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index student_admissions_school_number_unique_idx
  on public.student_admissions (school_id, lower(admission_number));

create unique index student_admissions_active_unique_idx
  on public.student_admissions (school_id, student_profile_id)
  where status = 'active';

create index student_admissions_school_status_idx
  on public.student_admissions (school_id, status);

create table public.student_academic_years (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.student_admissions (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete restrict,
  roll_number text,
  enrolled_on date not null default current_date,
  left_on date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'transferred', 'withdrawn')),
  promotion_status text
    check (promotion_status is null or promotion_status in ('promoted', 'repeated', 'transferred', 'graduated')),
  enrollment_type text not null default 'new_admission'
    check (enrollment_type in ('new_admission', 'promoted', 'repeated', 'transferred')),
  created_at timestamptz not null default now()
);

create unique index student_academic_years_active_unique_idx
  on public.student_academic_years (admission_id, academic_year_id)
  where status = 'active' and left_on is null;

create table public.parent_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons (id) on delete restrict,
  global_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.parent_profiles_set_global_id()
returns trigger
language plpgsql
as $$
begin
  if new.global_id is null or new.global_id = '' then
    new.global_id := public.next_global_id('PAR', 'public.parent_global_id_seq');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger parent_profiles_set_global_id_trg
  before insert or update on public.parent_profiles
  for each row execute function public.parent_profiles_set_global_id();

create table public.student_parent_links (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  parent_profile_id uuid not null references public.parent_profiles (id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_profile_id, parent_profile_id)
);

create table public.student_id_map (
  old_student_id uuid primary key,
  admission_id uuid not null,
  student_profile_id uuid not null,
  person_id uuid not null
);

-- Migrate students.
do $$
declare
  s record;
  person_uuid uuid;
  profile_uuid uuid;
  admission_uuid uuid;
begin
  for s in select * from public.students loop
    person_uuid := gen_random_uuid();
    profile_uuid := gen_random_uuid();
    admission_uuid := gen_random_uuid();

    insert into public.persons (id, global_id, full_name, date_of_birth, gender, photo_path)
    values (
      person_uuid,
      public.next_global_id('PER', 'public.person_global_id_seq'),
      s.full_name,
      s.date_of_birth,
      s.gender,
      s.photo_path
    );

    insert into public.student_profiles (id, person_id, global_id)
    values (
      profile_uuid,
      person_uuid,
      public.next_global_id('STD', 'public.student_global_id_seq')
    );

    insert into public.student_admissions (
      id, student_profile_id, school_id, admission_number, status, house_id, created_at, updated_at
    ) values (
      admission_uuid,
      profile_uuid,
      s.school_id,
      s.admission_number,
      case
        when s.status = 'alumni' then 'alumni'
        when s.status = 'withdrawn' then 'withdrawn'
        else 'active'
      end,
      s.house_id,
      s.created_at,
      s.updated_at
    );

    insert into public.student_id_map (old_student_id, admission_id, student_profile_id, person_id)
    values (s.id, admission_uuid, profile_uuid, person_uuid);
  end loop;
end $$;

insert into public.student_academic_years (
  admission_id,
  academic_year_id,
  class_id,
  section_id,
  enrolled_on,
  left_on,
  status,
  enrollment_type,
  created_at
)
select
  m.admission_id,
  e.academic_year_id,
  e.class_id,
  e.section_id,
  e.enrolled_on,
  e.left_on,
  e.status,
  e.enrollment_type,
  e.created_at
from public.student_section_enrollments e
join public.student_id_map m on m.old_student_id = e.student_id;

-- Migrate guardians → parent persons (best-effort; one person per guardian row).
do $$
declare
  g record;
  link record;
  person_uuid uuid;
  parent_uuid uuid;
  student_profile uuid;
begin
  for g in select * from public.guardians loop
    person_uuid := gen_random_uuid();
    parent_uuid := gen_random_uuid();

    insert into public.persons (id, global_id, full_name, email, phone)
    values (
      person_uuid,
      public.next_global_id('PER', 'public.person_global_id_seq'),
      g.full_name,
      g.email,
      coalesce(g.phone, g.whatsapp_number)
    );

    insert into public.parent_profiles (id, person_id, global_id)
    values (
      parent_uuid,
      person_uuid,
      public.next_global_id('PAR', 'public.parent_global_id_seq')
    );

    for link in
      select * from public.student_guardians where guardian_id = g.id
    loop
      select student_profile_id into student_profile
      from public.student_id_map
      where old_student_id = link.student_id;

      if student_profile is not null then
        insert into public.student_parent_links (
          student_profile_id, parent_profile_id, relationship, is_primary
        ) values (
          student_profile, parent_uuid, link.relationship, link.is_primary
        )
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;

alter table public.student_section_enrollments rename to student_section_enrollments_legacy;
alter table public.student_guardians rename to student_guardians_legacy;
alter table public.guardians rename to guardians_legacy;
alter table public.students rename to students_legacy;

alter table public.student_profiles enable row level security;
alter table public.student_admissions enable row level security;
alter table public.student_academic_years enable row level security;
alter table public.parent_profiles enable row level security;
alter table public.student_parent_links enable row level security;

revoke all on public.student_profiles from anon;
revoke all on public.student_admissions from anon;
revoke all on public.student_academic_years from anon;
revoke all on public.parent_profiles from anon;
revoke all on public.student_parent_links from anon;

grant select, insert, update, delete on public.student_profiles to authenticated;
grant select, insert, update, delete on public.student_admissions to authenticated;
grant select, insert, update, delete on public.student_academic_years to authenticated;
grant select, insert, update, delete on public.parent_profiles to authenticated;
grant select, insert, update, delete on public.student_parent_links to authenticated;

create policy student_admissions_own on public.student_admissions
  for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy student_academic_years_own on public.student_academic_years
  for all to authenticated
  using (
    admission_id in (
      select id from student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    admission_id in (
      select id from student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create policy student_profiles_via_admission on public.student_profiles
  for all to authenticated
  using (
    id in (
      select student_profile_id from student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (auth.uid() is not null);

create policy parent_profiles_via_student on public.parent_profiles
  for all to authenticated
  using (
    id in (
      select spl.parent_profile_id
      from student_parent_links spl
      join student_admissions sa on sa.student_profile_id = spl.student_profile_id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (auth.uid() is not null);

create policy student_parent_links_own on public.student_parent_links
  for all to authenticated
  using (
    student_profile_id in (
      select student_profile_id from student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    student_profile_id in (
      select student_profile_id from student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- Expand persons select/update to include student + parent links.
drop policy if exists persons_select_via_school_link on public.persons;
drop policy if exists persons_update_via_school_link on public.persons;

create policy persons_select_via_school_link on public.persons
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select sp.person_id
      from student_profiles sp
      join student_admissions sa on sa.student_profile_id = sp.id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select pp.person_id
      from parent_profiles pp
      join student_parent_links spl on spl.parent_profile_id = pp.id
      join student_admissions sa on sa.student_profile_id = spl.student_profile_id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create policy persons_update_via_school_link on public.persons
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select sp.person_id
      from student_profiles sp
      join student_admissions sa on sa.student_profile_id = sp.id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select pp.person_id
      from parent_profiles pp
      join student_parent_links spl on spl.parent_profile_id = pp.id
      join student_admissions sa on sa.student_profile_id = spl.student_profile_id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    auth_user_id = auth.uid()
    or id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select sp.person_id
      from student_profiles sp
      join student_admissions sa on sa.student_profile_id = sp.id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or id in (
      select pp.person_id
      from parent_profiles pp
      join student_parent_links spl on spl.parent_profile_id = pp.id
      join student_admissions sa on sa.student_profile_id = spl.student_profile_id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
