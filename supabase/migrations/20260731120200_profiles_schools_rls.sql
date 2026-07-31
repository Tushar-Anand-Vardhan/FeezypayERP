-- Stage 3: Row Level Security for schools and profiles.

alter table public.schools enable row level security;
alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke all on public.schools from anon;

revoke insert, delete on public.profiles from authenticated;
revoke insert, delete on public.schools from authenticated;

revoke update (role, school_id) on public.profiles from authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.schools to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy schools_select_own
  on public.schools
  for select
  to authenticated
  using (
    id in (
      select profiles.school_id
      from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy schools_update_own
  on public.schools
  for update
  to authenticated
  using (
    id in (
      select profiles.school_id
      from public.profiles
      where profiles.id = auth.uid()
    )
  )
  with check (
    id in (
      select profiles.school_id
      from public.profiles
      where profiles.id = auth.uid()
    )
  );
