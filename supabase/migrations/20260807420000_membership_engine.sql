-- Membership Engine (E29): school_memberships index, history, preferences,
-- employment_type expand, rewrite membership_schools / list_auth_memberships.

-- ---------------------------------------------------------------------------
-- 1. Expand teacher_employments.employment_type
-- ---------------------------------------------------------------------------

alter table public.teacher_employments
  drop constraint if exists teacher_employments_employment_type_check;

alter table public.teacher_employments
  add constraint teacher_employments_employment_type_check
  check (
    employment_type in (
      'full_time',
      'part_time',
      'contract',
      'guest',
      'consultant',
      'substitute'
    )
  );

-- Allow consultant/substitute personas on employments
alter table public.teacher_employments
  drop constraint if exists teacher_employments_school_persona_check;

alter table public.teacher_employments
  add constraint teacher_employments_school_persona_check
  check (
    school_persona in (
      'teacher',
      'principal',
      'vice_principal',
      'hod',
      'staff',
      'consultant',
      'substitute'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. school_memberships
-- ---------------------------------------------------------------------------

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  membership_kind text not null
    check (
      membership_kind in (
        'school_admin',
        'staff',
        'student',
        'parent',
        'alumni',
        'former_staff'
      )
    ),
  status text not null default 'active'
    check (
      status in ('invited', 'active', 'suspended', 'ended', 'transferred')
    ),
  effective_from date not null default (timezone('utc', now()))::date,
  effective_to date,
  school_persona text
    check (
      school_persona is null
      or school_persona in (
        'school_admin',
        'principal',
        'vice_principal',
        'hod',
        'teacher',
        'staff',
        'student',
        'parent',
        'alumni',
        'consultant',
        'substitute'
      )
    ),
  capability_class text not null
    check (capability_class in ('admin', 'teacher', 'student', 'parent')),
  source_type text not null
    check (
      source_type in (
        'profile',
        'employment',
        'admission',
        'parent_link'
      )
    ),
  source_id uuid not null,
  authz_role_ids uuid[] not null default '{}'::uuid[],
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_memberships_source_unique unique (source_type, source_id),
  constraint school_memberships_effective_range check (
    effective_to is null or effective_to >= effective_from
  )
);

create index if not exists school_memberships_person_idx
  on public.school_memberships (person_id)
  where archived_at is null;

create index if not exists school_memberships_school_idx
  on public.school_memberships (school_id)
  where archived_at is null;

create index if not exists school_memberships_status_idx
  on public.school_memberships (status)
  where archived_at is null;

-- At most one active membership per (person, school, kind)
create unique index if not exists school_memberships_active_kind_uidx
  on public.school_memberships (person_id, school_id, membership_kind)
  where status = 'active' and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. History
-- ---------------------------------------------------------------------------

create table if not exists public.school_membership_history (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.school_memberships (id) on delete cascade,
  changed_at timestamptz not null default timezone('utc', now()),
  changed_by uuid references auth.users (id) on delete set null,
  action text not null,
  old_row jsonb,
  new_row jsonb
);

create index if not exists school_membership_history_membership_idx
  on public.school_membership_history (membership_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 4. Preferences
-- ---------------------------------------------------------------------------

create table if not exists public.user_school_preferences (
  person_id uuid primary key references public.persons (id) on delete cascade,
  default_school_id uuid references public.schools (id) on delete set null,
  active_school_id uuid references public.schools (id) on delete set null,
  active_membership_id uuid references public.school_memberships (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 5. History trigger
-- ---------------------------------------------------------------------------

create or replace function public.school_memberships_history_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.school_membership_history (
      membership_id, changed_by, action, old_row, new_row
    ) values (
      new.id,
      auth.uid(),
      'created',
      null,
      to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if (
      old.status is distinct from new.status
      or old.effective_from is distinct from new.effective_from
      or old.effective_to is distinct from new.effective_to
      or old.school_persona is distinct from new.school_persona
      or old.capability_class is distinct from new.capability_class
      or old.membership_kind is distinct from new.membership_kind
      or old.archived_at is distinct from new.archived_at
      or old.authz_role_ids is distinct from new.authz_role_ids
    ) then
      insert into public.school_membership_history (
        membership_id, changed_by, action, old_row, new_row
      ) values (
        new.id,
        auth.uid(),
        case
          when new.archived_at is not null and old.archived_at is null then 'archived'
          when old.status is distinct from new.status then 'status_changed'
          else 'updated'
        end,
        to_jsonb(old),
        to_jsonb(new)
      );
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists school_memberships_history on public.school_memberships;
create trigger school_memberships_history
  after insert or update on public.school_memberships
  for each row
  execute function public.school_memberships_history_trg();

create or replace function public.school_memberships_touch_trg()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists school_memberships_touch on public.school_memberships;
create trigger school_memberships_touch
  before update on public.school_memberships
  for each row
  execute function public.school_memberships_touch_trg();

-- ---------------------------------------------------------------------------
-- 6. Backfill from source facts
-- ---------------------------------------------------------------------------

-- Admin profiles → need person bind; create person row if missing for admin
insert into public.persons (full_name, email, auth_user_id)
select
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'School Admin'),
  u.email,
  p.id
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'school_admin'
  and not exists (
    select 1 from public.persons pe where pe.auth_user_id = p.id
  )
on conflict do nothing;

-- persons may not have unique on auth_user_id in all envs — use where not exists above

insert into public.school_memberships (
  person_id,
  school_id,
  membership_kind,
  status,
  effective_from,
  school_persona,
  capability_class,
  source_type,
  source_id
)
select
  pe.id,
  p.school_id,
  'school_admin',
  'active',
  coalesce((p.created_at)::date, (timezone('utc', now()))::date),
  'school_admin',
  'admin',
  'profile',
  p.id
from public.profiles p
join public.persons pe on pe.auth_user_id = p.id
where p.role = 'school_admin'
on conflict (source_type, source_id) do nothing;

-- Staff employments
insert into public.school_memberships (
  person_id,
  school_id,
  membership_kind,
  status,
  effective_from,
  effective_to,
  school_persona,
  capability_class,
  source_type,
  source_id
)
select
  tp.person_id,
  te.school_id,
  case when te.status = 'ended' then 'former_staff' else 'staff' end,
  case
    when te.status = 'invited' then 'invited'
    when te.status = 'ended' then 'ended'
    else 'active'
  end,
  coalesce(te.joined_on, (te.created_at)::date, (timezone('utc', now()))::date),
  te.left_on,
  case
    when te.is_hod then 'hod'
    when te.employment_type in ('consultant', 'substitute') then te.employment_type
    else coalesce(te.school_persona, 'teacher')
  end,
  'teacher',
  'employment',
  te.id
from public.teacher_employments te
join public.teacher_profiles tp on tp.id = te.teacher_profile_id
on conflict (source_type, source_id) do nothing;

-- Student / alumni admissions
insert into public.school_memberships (
  person_id,
  school_id,
  membership_kind,
  status,
  effective_from,
  effective_to,
  school_persona,
  capability_class,
  source_type,
  source_id
)
select
  sp.person_id,
  sa.school_id,
  case when sa.status = 'alumni' then 'alumni' else 'student' end,
  case
    when sa.status = 'active' then 'active'
    when sa.status = 'alumni' then 'active'
    when sa.status = 'transferred' then 'transferred'
    when sa.status = 'withdrawn' then 'ended'
    else 'ended'
  end,
  coalesce(sa.admitted_on, (sa.created_at)::date, (timezone('utc', now()))::date),
  sa.exited_on,
  case when sa.status = 'alumni' then 'alumni' else 'student' end,
  'student',
  'admission',
  sa.id
from public.student_admissions sa
join public.student_profiles sp on sp.id = sa.student_profile_id
on conflict (source_type, source_id) do nothing;

-- Parent links (one membership per parent_profile + school of child's admission)
insert into public.school_memberships (
  person_id,
  school_id,
  membership_kind,
  status,
  effective_from,
  school_persona,
  capability_class,
  source_type,
  source_id
)
select distinct on (pp.person_id, sa.school_id)
  pp.person_id,
  sa.school_id,
  'parent',
  case
    when sa.status in ('active', 'alumni', 'transferred') then 'active'
    else 'ended'
  end,
  coalesce(sa.admitted_on, (timezone('utc', now()))::date),
  'parent',
  'parent',
  'parent_link',
  spl.id
from public.student_parent_links spl
join public.parent_profiles pp on pp.id = spl.parent_profile_id
join public.student_admissions sa on sa.student_profile_id = spl.student_profile_id
order by pp.person_id, sa.school_id, spl.id
on conflict (source_type, source_id) do nothing;

-- Seed preferences from user_active_context where person exists
insert into public.user_school_preferences (
  person_id,
  default_school_id,
  active_school_id,
  active_membership_id,
  updated_at
)
select
  pe.id,
  uac.school_id,
  uac.school_id,
  (
    select sm.id
    from public.school_memberships sm
    where sm.person_id = pe.id
      and sm.school_id = uac.school_id
      and sm.archived_at is null
    order by
      case when sm.school_persona = uac.persona then 0 else 1 end,
      case when sm.status in ('active', 'invited') then 0 else 1 end
    limit 1
  ),
  uac.updated_at
from public.user_active_context uac
join public.persons pe on pe.auth_user_id = uac.auth_user_id
on conflict (person_id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Rewrite membership helpers to prefer index
-- ---------------------------------------------------------------------------

create or replace function public.membership_schools(p_uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with indexed as (
    select distinct sm.school_id
    from public.school_memberships sm
    join public.persons pe on pe.id = sm.person_id
    where pe.auth_user_id = p_uid
      and sm.archived_at is null
      and sm.status in ('active', 'invited')
      and sm.effective_from <= (timezone('utc', now()))::date
      and (sm.effective_to is null or sm.effective_to >= (timezone('utc', now()))::date)
  ),
  hybrid as (
    select p.school_id
    from public.profiles p
    where p.id = p_uid
    union
    select te.school_id
    from public.teacher_employments te
    join public.teacher_profiles tp on tp.id = te.teacher_profile_id
    join public.persons pe on pe.id = tp.person_id
    where pe.auth_user_id = p_uid
      and te.status in ('active', 'invited')
    union
    select sa.school_id
    from public.student_admissions sa
    join public.student_profiles sp on sp.id = sa.student_profile_id
    join public.persons pe on pe.id = sp.person_id
    where pe.auth_user_id = p_uid
      and sa.status in ('active', 'alumni')
    union
    select sa.school_id
    from public.student_parent_links spl
    join public.parent_profiles pp on pp.id = spl.parent_profile_id
    join public.persons pe on pe.id = pp.person_id
    join public.student_admissions sa on sa.student_profile_id = spl.student_profile_id
    where pe.auth_user_id = p_uid
      and sa.status in ('active', 'alumni', 'transferred')
  )
  select school_id from indexed
  union
  select school_id from hybrid
  where not exists (select 1 from indexed);
$$;

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
  with indexed as (
    select
      sm.school_id,
      coalesce(sm.school_persona, sm.membership_kind)::text as persona,
      sm.source_type::text as source,
      sm.source_id,
      sm.status::text as status
    from public.school_memberships sm
    join public.persons pe on pe.id = sm.person_id
    where pe.auth_user_id = p_uid
      and sm.archived_at is null
  )
  select * from indexed
  union all
  -- Hybrid fallback only when person has zero indexed rows
  select * from (
    select
      p.school_id,
      'school_admin'::text,
      'profile'::text,
      p.id,
      'active'::text
    from public.profiles p
    where p.id = p_uid
      and p.role = 'school_admin'
    union all
    select
      te.school_id,
      case when te.is_hod then 'hod' else coalesce(te.school_persona, 'teacher') end,
      'employment'::text,
      te.id,
      te.status::text
    from public.teacher_employments te
    join public.teacher_profiles tp on tp.id = te.teacher_profile_id
    join public.persons pe on pe.id = tp.person_id
    where pe.auth_user_id = p_uid
    union all
    select
      sa.school_id,
      case when sa.status = 'alumni' then 'alumni' else 'student' end,
      'admission'::text,
      sa.id,
      sa.status::text
    from public.student_admissions sa
    join public.student_profiles sp on sp.id = sa.student_profile_id
    join public.persons pe on pe.id = sp.person_id
    where pe.auth_user_id = p_uid
    union all
    select
      sa.school_id,
      'parent'::text,
      'parent_link'::text,
      spl.id,
      sa.status::text
    from public.student_parent_links spl
    join public.parent_profiles pp on pp.id = spl.parent_profile_id
    join public.persons pe on pe.id = pp.person_id
    join public.student_admissions sa on sa.student_profile_id = spl.student_profile_id
    where pe.auth_user_id = p_uid
  ) hybrid
  where not exists (select 1 from indexed);
$$;

create or replace function public.list_memberships_for_uid(p_uid uuid default auth.uid())
returns table (
  membership_id uuid,
  school_id uuid,
  membership_kind text,
  status text,
  school_persona text,
  capability_class text,
  source_type text,
  source_id uuid,
  effective_from date,
  effective_to date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sm.id,
    sm.school_id,
    sm.membership_kind,
    sm.status,
    sm.school_persona,
    sm.capability_class,
    sm.source_type,
    sm.source_id,
    sm.effective_from,
    sm.effective_to
  from public.school_memberships sm
  join public.persons pe on pe.id = sm.person_id
  where pe.auth_user_id = p_uid
    and sm.archived_at is null
  order by sm.school_id, sm.membership_kind;
$$;

revoke all on function public.list_memberships_for_uid(uuid) from public;
grant execute on function public.list_memberships_for_uid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------

alter table public.school_memberships enable row level security;
alter table public.school_membership_history enable row level security;
alter table public.user_school_preferences enable row level security;

drop policy if exists school_memberships_select on public.school_memberships;
create policy school_memberships_select
  on public.school_memberships
  for select
  to authenticated
  using (
    school_id in (select public.membership_schools(auth.uid()))
    or person_id in (
      select id from public.persons where auth_user_id = auth.uid()
    )
  );

drop policy if exists school_memberships_write on public.school_memberships;
create policy school_memberships_write
  on public.school_memberships
  for all
  to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

drop policy if exists school_membership_history_select on public.school_membership_history;
create policy school_membership_history_select
  on public.school_membership_history
  for select
  to authenticated
  using (
    membership_id in (
      select id from public.school_memberships
      where school_id in (select public.membership_schools(auth.uid()))
         or person_id in (select id from public.persons where auth_user_id = auth.uid())
    )
  );

drop policy if exists user_school_preferences_own on public.user_school_preferences;
create policy user_school_preferences_own
  on public.user_school_preferences
  for all
  to authenticated
  using (
    person_id in (select id from public.persons where auth_user_id = auth.uid())
  )
  with check (
    person_id in (select id from public.persons where auth_user_id = auth.uid())
  );
