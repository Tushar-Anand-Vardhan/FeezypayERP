-- Stage 2: Auto-provision a school and profile when a new auth user is created.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_school_id uuid;
begin
  -- SECURITY DEFINER is required here because triggers on auth.users run in the
  -- auth schema execution context, where the invoking role cannot insert into
  -- public.schools or public.profiles. This is the sole narrowly scoped
  -- exception: the function performs only these two provisioning inserts and
  -- nothing else. search_path is pinned to public to prevent search-path attacks.

  if exists (
    select 1
    from public.profiles
    where id = new.id
  ) then
    return new;
  end if;

  insert into public.schools
  default values
  returning id into new_school_id;

  insert into public.profiles (id, role, school_id)
  values (new.id, 'school_admin', new_school_id)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise;
end;
$$;

comment on function public.handle_new_user() is
  'Provisions a new school and school_admin profile when a user signs up. Runs as SECURITY DEFINER because auth triggers cannot write to public tables otherwise.';

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
