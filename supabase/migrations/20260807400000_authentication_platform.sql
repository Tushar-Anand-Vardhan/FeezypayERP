-- Phase 2.5 Authentication Platform (F11, invites, membership helpers, RLS cutover).
-- Permissions (E03) are intentionally out of scope.

-- ---------------------------------------------------------------------------
-- 1. Employment school_persona
-- ---------------------------------------------------------------------------

alter table public.teacher_employments
  add column if not exists school_persona text not null default 'teacher'
    check (school_persona in (
      'teacher', 'principal', 'vice_principal', 'hod', 'staff'
    ));

update public.teacher_employments
set school_persona = 'hod'
where is_hod = true
  and school_persona = 'teacher';

comment on column public.teacher_employments.school_persona is
  'AuthN routing persona for staff at this school (not E03 permission keys).';

-- ---------------------------------------------------------------------------
-- 2. auth_invites
-- ---------------------------------------------------------------------------

create table public.auth_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  email text not null,
  person_id uuid not null references public.persons (id) on delete restrict,
  target_persona text not null
    check (target_persona in (
      'teacher', 'principal', 'vice_principal', 'hod', 'staff',
      'student', 'parent', 'alumni'
    )),
  employment_id uuid references public.teacher_employments (id) on delete set null,
  admission_id uuid references public.student_admissions (id) on delete set null,
  parent_profile_id uuid references public.parent_profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  auth_user_id uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auth_invites_school_status_idx
  on public.auth_invites (school_id, status)
  where archived_at is null;

create index auth_invites_email_pending_idx
  on public.auth_invites (lower(email))
  where status = 'pending' and archived_at is null;

create index auth_invites_person_idx
  on public.auth_invites (person_id);

create unique index auth_invites_pending_email_school_uidx
  on public.auth_invites (school_id, lower(email))
  where status = 'pending' and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. user_active_context
-- ---------------------------------------------------------------------------

create table public.user_active_context (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  persona text not null
    check (persona in (
      'school_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'staff',
      'student', 'parent', 'alumni'
    )),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Service-role admin audit (invite adapter)
-- ---------------------------------------------------------------------------

create table public.auth_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  actor_auth_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_email text,
  invite_id uuid references public.auth_invites (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index auth_admin_audit_log_school_idx
  on public.auth_admin_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. SQL helpers
-- ---------------------------------------------------------------------------

create or replace function public.auth_person_id(p_uid uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.persons
  where auth_user_id = p_uid
  limit 1;
$$;

revoke all on function public.auth_person_id(uuid) from public;
grant execute on function public.auth_person_id(uuid) to authenticated;

create or replace function public.membership_schools(p_uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- School admin bootstrap (E01)
  select p.school_id
  from public.profiles p
  where p.id = p_uid
    and p.school_id is not null

  union

  -- Staff employments (active or invited)
  select e.school_id
  from public.persons per
  join public.teacher_profiles tp on tp.person_id = per.id
  join public.teacher_employments e on e.teacher_profile_id = tp.id
  where per.auth_user_id = p_uid
    and e.status in ('active', 'invited')

  union

  -- Student admissions (active or alumni)
  select a.school_id
  from public.persons per
  join public.student_profiles sp on sp.person_id = per.id
  join public.student_admissions a on a.student_profile_id = sp.id
  where per.auth_user_id = p_uid
    and a.status in ('active', 'alumni')

  union

  -- Parent via linked children's admissions
  select a.school_id
  from public.persons per
  join public.parent_profiles pp on pp.person_id = per.id
  join public.student_parent_links spl on spl.parent_profile_id = pp.id
  join public.student_admissions a on a.student_profile_id = spl.student_profile_id
  where per.auth_user_id = p_uid
    and a.status in ('active', 'alumni', 'transferred');
$$;

revoke all on function public.membership_schools(uuid) from public;
grant execute on function public.membership_schools(uuid) to authenticated;

create or replace function public.list_auth_memberships(p_uid uuid default auth.uid())
returns table (
  school_id uuid,
  persona text,
  source text,
  source_id uuid,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.school_id,
    'school_admin'::text as persona,
    'profile'::text as source,
    p.id as source_id,
    'active'::text as status
  from public.profiles p
  where p.id = p_uid

  union all

  select
    e.school_id,
    case
      when e.is_hod then 'hod'
      else e.school_persona
    end as persona,
    'employment'::text as source,
    e.id as source_id,
    e.status
  from public.persons per
  join public.teacher_profiles tp on tp.person_id = per.id
  join public.teacher_employments e on e.teacher_profile_id = tp.id
  where per.auth_user_id = p_uid
    and e.status in ('active', 'invited', 'ended')

  union all

  select
    a.school_id,
    case when a.status = 'alumni' then 'alumni' else 'student' end as persona,
    'admission'::text as source,
    a.id as source_id,
    a.status
  from public.persons per
  join public.student_profiles sp on sp.person_id = per.id
  join public.student_admissions a on a.student_profile_id = sp.id
  where per.auth_user_id = p_uid

  union all

  select
    a.school_id,
    'parent'::text as persona,
    'parent_link'::text as source,
    spl.id as source_id,
    a.status
  from public.persons per
  join public.parent_profiles pp on pp.person_id = per.id
  join public.student_parent_links spl on spl.parent_profile_id = pp.id
  join public.student_admissions a on a.student_profile_id = spl.student_profile_id
  where per.auth_user_id = p_uid;
$$;

revoke all on function public.list_auth_memberships(uuid) from public;
grant execute on function public.list_auth_memberships(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. F11 — handle_new_user split
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_school_id uuid;
  signup_intent text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  signup_intent := coalesce(new.raw_user_meta_data ->> 'intent', '');

  -- Only SaaS school owners provision a tenant + admin profile.
  if signup_intent = 'create_school' then
    insert into public.schools
    default values
    returning id into new_school_id;

    insert into public.profiles (id, role, school_id)
    values (new.id, 'school_admin', new_school_id)
    on conflict (id) do nothing;
  end if;

  -- intent=accept_invite (and anything else): no school/profile here.
  return new;
exception
  when others then
    raise;
end;
$$;

comment on function public.handle_new_user() is
  'F11: provisions school + school_admin profile only when auth.users.raw_user_meta_data.intent = create_school. Invite path does not create a school.';

-- ---------------------------------------------------------------------------
-- 7. RLS on new tables
-- ---------------------------------------------------------------------------

alter table public.auth_invites enable row level security;
alter table public.user_active_context enable row level security;
alter table public.auth_admin_audit_log enable row level security;

create policy auth_invites_school_member_all
  on public.auth_invites
  for all
  to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

create policy user_active_context_own
  on public.user_active_context
  for all
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy auth_admin_audit_log_school_select
  on public.auth_admin_audit_log
  for select
  to authenticated
  using (
    school_id is null
    or school_id in (select public.membership_schools(auth.uid()))
  );

-- Inserts to auth_admin_audit_log go through service role / security definer paths.
create policy auth_admin_audit_log_insert_authenticated
  on public.auth_admin_audit_log
  for insert
  to authenticated
  with check (
    actor_auth_user_id = auth.uid()
    and (
      school_id is null
      or school_id in (select public.membership_schools(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 8. RLS cutover: profiles.school_id → membership_schools(auth.uid())
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
  new_qual text;
  new_with_check text;
  cmd_clause text;
  roles_clause text;
  using_clause text;
  check_clause text;
  sql text;
begin
  for pol in
    select
      schemaname,
      tablename,
      policyname,
      cmd,
      roles,
      qual,
      with_check,
      permissive
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%from%profiles%school_id%'
        or coalesce(with_check, '') ilike '%from%profiles%school_id%'
        or coalesce(qual, '') ilike '%profiles.school_id%'
        or coalesce(with_check, '') ilike '%profiles.school_id%'
      )
  loop
    new_qual := pol.qual;
    new_with_check := pol.with_check;

    if new_qual is not null then
      new_qual := regexp_replace(
        new_qual,
        'school_id\s+in\s*\(\s*select\s+school_id\s+from\s+(public\.)?profiles\s+where\s+(public\.)?profiles\.id\s*=\s*auth\.uid\(\)\s*\)',
        'school_id in (select public.membership_schools(auth.uid()))',
        'gi'
      );
      new_qual := regexp_replace(
        new_qual,
        'school_id\s+in\s*\(\s*select\s+school_id\s+from\s+(public\.)?profiles\s+where\s+id\s*=\s*auth\.uid\(\)\s*\)',
        'school_id in (select public.membership_schools(auth.uid()))',
        'gi'
      );
    end if;

    if new_with_check is not null then
      new_with_check := regexp_replace(
        new_with_check,
        'school_id\s+in\s*\(\s*select\s+school_id\s+from\s+(public\.)?profiles\s+where\s+(public\.)?profiles\.id\s*=\s*auth\.uid\(\)\s*\)',
        'school_id in (select public.membership_schools(auth.uid()))',
        'gi'
      );
      new_with_check := regexp_replace(
        new_with_check,
        'school_id\s+in\s*\(\s*select\s+school_id\s+from\s+(public\.)?profiles\s+where\s+id\s*=\s*auth\.uid\(\)\s*\)',
        'school_id in (select public.membership_schools(auth.uid()))',
        'gi'
      );
    end if;

    -- Skip if nothing changed
    if new_qual is not distinct from pol.qual
       and new_with_check is not distinct from pol.with_check then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );

    cmd_clause := case upper(pol.cmd)
      when 'SELECT' then 'for select'
      when 'INSERT' then 'for insert'
      when 'UPDATE' then 'for update'
      when 'DELETE' then 'for delete'
      when 'ALL' then 'for all'
      else 'for all'
    end;

    if pol.roles is null or cardinality(pol.roles) = 0
       or (cardinality(pol.roles) = 1 and pol.roles[1] = '-') then
      roles_clause := 'to authenticated';
    else
      roles_clause := 'to ' || array_to_string(
        array(select quote_ident(r) from unnest(pol.roles) as r),
        ', '
      );
    end if;

    using_clause := '';
    check_clause := '';
    if new_qual is not null and upper(pol.cmd) <> 'INSERT' then
      using_clause := ' using (' || new_qual || ')';
    end if;
    if new_with_check is not null and upper(pol.cmd) in ('INSERT', 'UPDATE', 'ALL') then
      check_clause := ' with check (' || new_with_check || ')';
    elsif new_qual is not null and upper(pol.cmd) = 'ALL' and new_with_check is null then
      check_clause := ' with check (' || new_qual || ')';
    end if;

    -- INSERT-only policies use with check
    if upper(pol.cmd) = 'INSERT' and new_with_check is null and new_qual is not null then
      check_clause := ' with check (' || new_qual || ')';
      using_clause := '';
    end if;

    sql := format(
      'create policy %I on %I.%I as %s %s %s%s%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      cmd_clause,
      roles_clause,
      using_clause,
      check_clause
    );

    begin
      execute sql;
    exception
      when others then
        raise notice 'RLS cutover skipped policy %.%: % — %',
          pol.tablename, pol.policyname, sqlerrm, sql;
    end;
  end loop;
end;
$$;
