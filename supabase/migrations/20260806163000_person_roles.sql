-- Person roles for multi-role humans + self-access readiness.

create table public.person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  role text not null check (role in ('teacher', 'student', 'parent', 'admin')),
  created_at timestamptz not null default now(),
  unique (person_id, role)
);

alter table public.person_roles enable row level security;
revoke all on public.person_roles from anon;
grant select, insert, update, delete on public.person_roles to authenticated;

create policy person_roles_via_person on public.person_roles
  for all to authenticated
  using (
    person_id in (
      select id from persons
      where auth_user_id = auth.uid()
    )
    or person_id in (
      select tp.person_id
      from teacher_profiles tp
      join teacher_employments te on te.teacher_profile_id = tp.id
      where te.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    or person_id in (
      select sp.person_id
      from student_profiles sp
      join student_admissions sa on sa.student_profile_id = sp.id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (auth.uid() is not null);

-- Backfill roles from migrated profiles.
insert into public.person_roles (person_id, role)
select person_id, 'teacher' from public.teacher_profiles
on conflict do nothing;

insert into public.person_roles (person_id, role)
select person_id, 'student' from public.student_profiles
on conflict do nothing;

insert into public.person_roles (person_id, role)
select person_id, 'parent' from public.parent_profiles
on conflict do nothing;

comment on table public.person_roles is
  'A person may hold multiple roles (teacher+parent, alumni+teacher, etc.).';
