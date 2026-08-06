-- Allow school admins to resolve existing people by identity keys without global SELECT.

create or replace function public.find_person_by_identity(
  p_email text default null,
  p_aadhaar_hash text default null
)
returns table (
  id uuid,
  global_id text,
  full_name text,
  email text,
  phone text,
  aadhaar_hash text,
  aadhaar_last4 text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_aadhaar_hash is not null and length(p_aadhaar_hash) > 0 then
    return query
      select p.id, p.global_id, p.full_name, p.email, p.phone, p.aadhaar_hash, p.aadhaar_last4
      from public.persons p
      where p.aadhaar_hash = p_aadhaar_hash
      limit 1;
    if found then
      return;
    end if;
  end if;

  if p_email is not null and length(trim(p_email)) > 0 then
    return query
      select p.id, p.global_id, p.full_name, p.email, p.phone, p.aadhaar_hash, p.aadhaar_last4
      from public.persons p
      where lower(p.email) = lower(trim(p_email))
      limit 1;
  end if;
end;
$$;

revoke all on function public.find_person_by_identity(text, text) from public;
grant execute on function public.find_person_by_identity(text, text) to authenticated;

create or replace function public.get_teacher_profile_for_person(p_person_id uuid)
returns table (id uuid, global_id text, person_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select tp.id, tp.global_id, tp.person_id
    from public.teacher_profiles tp
    where tp.person_id = p_person_id
    limit 1;
end;
$$;

revoke all on function public.get_teacher_profile_for_person(uuid) from public;
grant execute on function public.get_teacher_profile_for_person(uuid) to authenticated;

create or replace function public.get_student_profile_for_person(p_person_id uuid)
returns table (id uuid, global_id text, person_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select sp.id, sp.global_id, sp.person_id
    from public.student_profiles sp
    where sp.person_id = p_person_id
    limit 1;
end;
$$;

revoke all on function public.get_student_profile_for_person(uuid) from public;
grant execute on function public.get_student_profile_for_person(uuid) to authenticated;
