-- Security-definer helpers so onboarding can create identities under RLS.

create or replace function public.create_person_record(
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_aadhaar_hash text default null,
  p_aadhaar_last4 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.persons (
    full_name, email, phone, date_of_birth, gender, aadhaar_hash, aadhaar_last4
  ) values (
    p_full_name, p_email, p_phone, p_date_of_birth, p_gender, p_aadhaar_hash, p_aadhaar_last4
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.create_teacher_profile_record(p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.teacher_profiles (person_id)
  values (p_person_id)
  on conflict (person_id) do update set updated_at = now()
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.teacher_profiles where person_id = p_person_id;
  end if;

  insert into public.person_roles (person_id, role)
  values (p_person_id, 'teacher')
  on conflict do nothing;

  return new_id;
end;
$$;

create or replace function public.create_student_profile_record(p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.student_profiles (person_id)
  values (p_person_id)
  on conflict (person_id) do update set updated_at = now()
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.student_profiles where person_id = p_person_id;
  end if;

  insert into public.person_roles (person_id, role)
  values (p_person_id, 'student')
  on conflict do nothing;

  return new_id;
end;
$$;

create or replace function public.create_parent_profile_record(p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.parent_profiles (person_id)
  values (p_person_id)
  on conflict (person_id) do update set updated_at = now()
  returning id into new_id;

  if new_id is null then
    select id into new_id from public.parent_profiles where person_id = p_person_id;
  end if;

  insert into public.person_roles (person_id, role)
  values (p_person_id, 'parent')
  on conflict do nothing;

  return new_id;
end;
$$;

create or replace function public.update_person_record(
  p_person_id uuid,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_aadhaar_hash text default null,
  p_aadhaar_last4 text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.persons
  set
    full_name = coalesce(p_full_name, full_name),
    email = coalesce(p_email, email),
    phone = coalesce(p_phone, phone),
    date_of_birth = coalesce(p_date_of_birth, date_of_birth),
    gender = coalesce(p_gender, gender),
    aadhaar_hash = coalesce(p_aadhaar_hash, aadhaar_hash),
    aadhaar_last4 = coalesce(p_aadhaar_last4, aadhaar_last4),
    updated_at = now()
  where id = p_person_id;
end;
$$;

revoke all on function public.create_person_record(text, text, text, date, text, text, text) from public;
revoke all on function public.create_teacher_profile_record(uuid) from public;
revoke all on function public.create_student_profile_record(uuid) from public;
revoke all on function public.create_parent_profile_record(uuid) from public;
revoke all on function public.update_person_record(uuid, text, text, text, date, text, text, text) from public;

grant execute on function public.create_person_record(text, text, text, date, text, text, text) to authenticated;
grant execute on function public.create_teacher_profile_record(uuid) to authenticated;
grant execute on function public.create_student_profile_record(uuid) to authenticated;
grant execute on function public.create_parent_profile_record(uuid) to authenticated;
grant execute on function public.update_person_record(uuid, text, text, text, date, text, text, text) to authenticated;
