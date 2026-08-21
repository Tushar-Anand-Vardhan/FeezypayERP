-- Hosted Supabase rejects set_config('session_replication_role', ...).
-- Reset instead with exception-tolerant multi-pass deletes (FK order converges).

create or replace function public.reset_school_onboarding(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n bigint;
  deleted bigint;
  pass int := 0;
  admin_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_school_id is null then
    raise exception 'school_id is required';
  end if;

  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'School not found';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = p_school_id
      and p.role = 'school_admin'
  ) then
    raise exception 'Only the school admin can reset onboarding';
  end if;

  admin_uid := auth.uid();

  -- Children without school_id that block academic_year / class / employment deletes.
  delete from public.exam_results er
  using public.exam_definitions ed
  join public.academic_years y on y.id = ed.academic_year_id
  where er.exam_definition_id = ed.id
    and y.school_id = p_school_id;

  delete from public.exam_subject_schedules ess
  using public.exam_definitions ed
  join public.academic_years y on y.id = ed.academic_year_id
  where ess.exam_definition_id = ed.id
    and y.school_id = p_school_id;

  delete from public.exam_definitions ed
  using public.academic_years y
  where ed.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.timetable_slots ts
  using public.sections s
  join public.classes c on c.id = s.class_id
  join public.academic_years y on y.id = c.academic_year_id
  where ts.section_id = s.id
    and y.school_id = p_school_id;

  delete from public.class_subjects cs
  using public.classes c
  join public.academic_years y on y.id = c.academic_year_id
  where cs.class_id = c.id
    and y.school_id = p_school_id;

  delete from public.sections s
  using public.classes c
  join public.academic_years y on y.id = c.academic_year_id
  where s.class_id = c.id
    and y.school_id = p_school_id;

  delete from public.classes c
  using public.academic_years y
  where c.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.holidays h
  using public.academic_years y
  where h.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.terms t
  using public.academic_years y
  where t.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.period_definitions pd
  using public.academic_years y
  where pd.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.timetable_grids tg
  using public.academic_years y
  where tg.academic_year_id = y.id
    and y.school_id = p_school_id;

  delete from public.employment_subjects es
  using public.teacher_employments te
  where es.employment_id = te.id
    and te.school_id = p_school_id;

  delete from public.house_memberships hm
  using public.houses h
  where hm.house_id = h.id
    and h.school_id = p_school_id;

  delete from public.club_memberships cm
  using public.clubs c
  where cm.club_id = c.id
    and c.school_id = p_school_id;

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
        and c.table_name <> 'profiles'
      order by c.table_name
    loop
      begin
        execute format(
          'with d as (delete from public.%I where school_id = %L returning 1)
           select count(*)::bigint from d',
          r.table_name,
          p_school_id
        ) into n;
        deleted := deleted + coalesce(n, 0);
      exception
        when foreign_key_violation then
          n := 0;
      end;
    end loop;

    exit when deleted = 0 or pass >= 40;
  end loop;

  if pass >= 40 and deleted > 0 then
    raise exception 'Reset did not converge after % passes (last deleted %)', pass, deleted;
  end if;

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

  update public.schools
  set
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
  where id = p_school_id;

  insert into public.profiles (id, role, school_id, full_name)
  values (admin_uid, 'school_admin', p_school_id, 'School Admin')
  on conflict (id) do update
  set role = 'school_admin',
      school_id = p_school_id,
      updated_at = now();

  insert into public.school_memberships (
    person_id, school_id, membership_kind, status, school_persona,
    capability_class, source_type, source_id, authz_role_ids
  )
  select
    p.id,
    p_school_id,
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
  values (admin_uid, p_school_id, 'school_admin', now())
  on conflict (auth_user_id) do update
  set school_id = excluded.school_id,
      persona = excluded.persona,
      updated_at = now();
end;
$$;

revoke all on function public.reset_school_onboarding(uuid) from public;
grant execute on function public.reset_school_onboarding(uuid) to authenticated;

comment on function public.reset_school_onboarding(uuid) is
  'School-admin only. Wipes school-scoped operational data and restarts onboarding without session_replication_role.';
