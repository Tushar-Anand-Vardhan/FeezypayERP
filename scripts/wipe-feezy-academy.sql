-- Wipe Feezypay Academy tenant data so onboarding can restart.
-- Keeps: school row + school_admin profile (auth login).
-- Removes: all school-scoped rows, demo auth users (@feezy.demo / @feezy.test),
--          orphan identity profiles left with no remaining affiliations.

begin;

-- Bypass FK checks for a controlled tenant wipe (staging only).
set local session_replication_role = replica;

do $$
declare
  sid uuid := '6385483b-8f79-49fc-9bd4-b19d2cef684a';
  r record;
  n bigint;
  deleted bigint;
  pass int := 0;
  admin_uid uuid;
begin
  if not exists (select 1 from public.schools where id = sid) then
    raise exception 'Feezypay Academy school % not found', sid;
  end if;

  select p.id into admin_uid
  from public.profiles p
  where p.school_id = sid and p.role = 'school_admin'
  order by p.created_at
  limit 1;

  -- -------------------------------------------------------------------------
  -- 1. Multi-pass delete every public table that has school_id for this school
  -- -------------------------------------------------------------------------
  loop
    pass := pass + 1;
    deleted := 0;

    for r in
      select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
      where c.table_schema = 'public'
        and c.column_name = 'school_id'
        and t.table_type = 'BASE TABLE'
        -- Keep admin bootstrap row; wipe only operational school data.
        and c.table_name <> 'profiles'
      order by c.table_name
    loop
      execute format(
        'with d as (delete from public.%I where school_id = %L returning 1)
         select count(*)::bigint from d',
        r.table_name,
        sid
      ) into n;
      deleted := deleted + coalesce(n, 0);
    end loop;

    exit when deleted = 0 or pass >= 40;
  end loop;

  if pass >= 40 and deleted > 0 then
    raise exception 'Wipe did not converge after % passes (last deleted %)', pass, deleted;
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Orphan sweep: children without school_id left dangling after replica deletes
  -- -------------------------------------------------------------------------
  delete from public.holidays h
  where not exists (select 1 from public.academic_years y where y.id = h.academic_year_id);

  delete from public.terms t
  where not exists (select 1 from public.academic_years y where y.id = t.academic_year_id);

  delete from public.period_definitions pd
  where not exists (select 1 from public.academic_years y where y.id = pd.academic_year_id);

  delete from public.timetable_grids tg
  where not exists (select 1 from public.academic_years y where y.id = tg.academic_year_id);

  delete from public.classes c
  where not exists (select 1 from public.academic_years y where y.id = c.academic_year_id);

  delete from public.sections s
  where not exists (select 1 from public.classes c where c.id = s.class_id);

  delete from public.class_subjects cs
  where not exists (select 1 from public.classes c where c.id = cs.class_id)
     or not exists (select 1 from public.subjects sub where sub.id = cs.subject_id);

  delete from public.timetable_slots ts
  where not exists (select 1 from public.sections s where s.id = ts.section_id);

  delete from public.employment_subjects es
  where not exists (select 1 from public.teacher_employments te where te.id = es.employment_id)
     or not exists (select 1 from public.subjects sub where sub.id = es.subject_id);

  delete from public.house_memberships hm
  where not exists (select 1 from public.houses h where h.id = hm.house_id);

  delete from public.club_memberships cm
  where not exists (select 1 from public.clubs c where c.id = cm.club_id);

  delete from public.exam_definitions ed
  where not exists (select 1 from public.academic_years y where y.id = ed.academic_year_id);

  delete from public.exam_subject_schedules ess
  where not exists (
    select 1 from public.exam_definitions ed where ed.id = ess.exam_definition_id
  );

  delete from public.exam_results er
  where not exists (
    select 1 from public.exam_definitions ed where ed.id = er.exam_definition_id
  );

  -- -------------------------------------------------------------------------
  -- 3. Reset school to onboarding-ready defaults (keep id + admin link)
  -- -------------------------------------------------------------------------
  update public.schools
  set
    name = 'Feezypay Academy',
    onboarding_status = 'in_progress',
    logo_path = null,
    address_street = null,
    address_city = null,
    address_state = null,
    address_pincode = null,
    contact_phone = null,
    contact_email = null,
    board = null,
    affiliation_number = null,
    academic_year_start_month = null,
    whatsapp_report_follows_terms = true,
    houses_enabled = false,
    clubs_enabled = false,
    timetable_skipped = false,
    houses_clubs_completed = false,
    code = null,
    updated_at = now()
  where id = sid;

  update public.user_active_context
  set school_id = null
  where school_id = sid;

  -- -------------------------------------------------------------------------
  -- 4. Remove demo Auth users (not the school admin)
  -- -------------------------------------------------------------------------
  delete from auth.users u
  where (
      lower(u.email) like '%@feezy.demo'
      or lower(u.email) like '%@feezy.test'
    )
    and (admin_uid is null or u.id <> admin_uid);

  -- -------------------------------------------------------------------------
  -- 5. Orphan identity cleanup (demo/smoke only)
  -- -------------------------------------------------------------------------
  delete from public.parent_profiles pp
  where not exists (
    select 1 from public.student_parent_links spl where spl.parent_profile_id = pp.id
  )
  and exists (
    select 1 from public.persons p
    where p.id = pp.person_id
      and (
        lower(coalesce(p.email, '')) like '%@feezy.demo'
        or lower(coalesce(p.email, '')) like '%@feezy.test'
      )
  );

  delete from public.student_profiles sp
  where not exists (
    select 1 from public.student_admissions sa where sa.student_profile_id = sp.id
  )
  and exists (
    select 1 from public.persons p
    where p.id = sp.person_id
      and (
        lower(coalesce(p.email, '')) like '%@feezy.demo'
        or lower(coalesce(p.email, '')) like '%@feezy.test'
        or lower(coalesce(p.email, '')) like 'smoke-%'
      )
  );

  delete from public.teacher_profiles tp
  where not exists (
    select 1 from public.teacher_employments te where te.teacher_profile_id = tp.id
  )
  and exists (
    select 1 from public.persons p
    where p.id = tp.person_id
      and (
        lower(coalesce(p.email, '')) like '%@feezy.demo'
        or lower(coalesce(p.email, '')) like '%@feezy.test'
        or lower(coalesce(p.email, '')) like 'smoke-%'
      )
  );

  delete from public.persons p
  where not exists (select 1 from public.teacher_profiles tp where tp.person_id = p.id)
    and not exists (select 1 from public.student_profiles sp where sp.person_id = p.id)
    and not exists (select 1 from public.parent_profiles pp where pp.person_id = p.id)
    and not exists (select 1 from public.school_memberships sm where sm.person_id = p.id)
    and (
      lower(coalesce(p.email, '')) like '%@feezy.demo'
      or lower(coalesce(p.email, '')) like '%@feezy.test'
      or lower(coalesce(p.email, '')) like 'smoke-%'
    )
    and (admin_uid is null or p.auth_user_id is distinct from admin_uid);

  -- -------------------------------------------------------------------------
  -- 6. Re-index school_admin membership (wiped with school_memberships)
  -- -------------------------------------------------------------------------
  if admin_uid is not null then
    insert into public.profiles (id, role, school_id, full_name)
    values (admin_uid, 'school_admin', sid, 'School Admin')
    on conflict (id) do update
    set role = 'school_admin',
        school_id = sid,
        updated_at = now();

    insert into public.school_memberships (
      person_id, school_id, membership_kind, status, school_persona,
      capability_class, source_type, source_id, authz_role_ids
    )
    select
      p.id,
      sid,
      'school_admin',
      'active',
      'school_admin',
      'admin',
      'profile',
      admin_uid,
      array(
        select ar.id from public.authz_roles ar
        where ar.code = 'school_admin' and ar.school_id is null
        limit 1
      )
    from public.persons p
    where p.auth_user_id = admin_uid
    on conflict (source_type, source_id) do update
    set status = 'active',
        archived_at = null,
        school_id = excluded.school_id,
        person_id = excluded.person_id,
        authz_role_ids = excluded.authz_role_ids,
        updated_at = now();

    insert into public.user_active_context (auth_user_id, school_id, persona, updated_at)
    values (admin_uid, sid, 'school_admin', now())
    on conflict (auth_user_id) do update
    set school_id = excluded.school_id,
        persona = excluded.persona,
        updated_at = now();
  end if;

  raise notice 'Feezypay Academy wiped. Admin uid kept: %', admin_uid;
end $$;

set local session_replication_role = origin;

commit;

-- Verification
select id, name, onboarding_status, code, board, academic_year_start_month,
       houses_enabled, clubs_enabled, timetable_skipped, houses_clubs_completed
from public.schools
where id = '6385483b-8f79-49fc-9bd4-b19d2cef684a';

select 'academic_years' as t, count(*)::int as n from public.academic_years
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'subjects', count(*)::int from public.subjects
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'teacher_employments', count(*)::int from public.teacher_employments
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'student_admissions', count(*)::int from public.student_admissions
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'school_memberships', count(*)::int from public.school_memberships
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'profiles', count(*)::int from public.profiles
  where school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
union all select 'classes_via_years', count(*)::int from public.classes c
  where exists (
    select 1 from public.academic_years y
    where y.id = c.academic_year_id
      and y.school_id = '6385483b-8f79-49fc-9bd4-b19d2cef684a'
  );
