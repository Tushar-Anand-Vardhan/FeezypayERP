-- Phase 2.6 Authorization Platform (E03)

create table public.authz_permissions (
  key text primary key,
  domain text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.authz_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_system boolean not null default false,
  school_id uuid references public.schools (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_system = true and school_id is null)
    or (is_system = false and school_id is not null)
  )
);

create unique index authz_roles_system_code_uidx
  on public.authz_roles (code)
  where is_system = true;

create unique index authz_roles_school_code_uidx
  on public.authz_roles (school_id, code)
  where is_system = false and archived_at is null;

create table public.authz_role_permissions (
  role_id uuid not null references public.authz_roles (id) on delete cascade,
  permission_key text not null references public.authz_permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.authz_member_role_grants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role_id uuid not null references public.authz_roles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index authz_member_role_grants_person_school_idx
  on public.authz_member_role_grants (person_id, school_id)
  where revoked_at is null;

create table public.authz_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete set null,
  actor_auth_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index authz_audit_log_school_idx
  on public.authz_audit_log (school_id, created_at desc);

alter table public.authz_permissions enable row level security;
alter table public.authz_roles enable row level security;
alter table public.authz_role_permissions enable row level security;
alter table public.authz_member_role_grants enable row level security;
alter table public.authz_audit_log enable row level security;

create policy authz_permissions_read
  on public.authz_permissions for select to authenticated
  using (true);

create policy authz_roles_select
  on public.authz_roles for select to authenticated
  using (
    is_system = true
    or school_id in (select public.membership_schools(auth.uid()))
  );

create policy authz_roles_write
  on public.authz_roles for all to authenticated
  using (
    is_system = false
    and school_id in (select public.membership_schools(auth.uid()))
  )
  with check (
    is_system = false
    and school_id in (select public.membership_schools(auth.uid()))
  );

create policy authz_role_permissions_select
  on public.authz_role_permissions for select to authenticated
  using (true);

create policy authz_role_permissions_write
  on public.authz_role_permissions for all to authenticated
  using (
    exists (
      select 1 from public.authz_roles r
      where r.id = role_id
        and r.is_system = false
        and r.school_id in (select public.membership_schools(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.authz_roles r
      where r.id = role_id
        and r.is_system = false
        and r.school_id in (select public.membership_schools(auth.uid()))
    )
  );

create policy authz_member_grants_school
  on public.authz_member_role_grants for all to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

create policy authz_audit_log_select
  on public.authz_audit_log for select to authenticated
  using (
    school_id is null
    or school_id in (select public.membership_schools(auth.uid()))
  );

create policy authz_audit_log_insert
  on public.authz_audit_log for insert to authenticated
  with check (
    actor_auth_user_id = auth.uid()
    and (
      school_id is null
      or school_id in (select public.membership_schools(auth.uid()))
    )
  );

-- App-evaluator mirror (coarse). Prefer lib/authz for ABAC.
create or replace function public.has_permission(
  p_uid uuid,
  p_school_id uuid,
  p_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  person uuid;
begin
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_uid
      and pr.school_id = p_school_id
      and pr.role = 'school_admin'
  ) into is_admin;

  if is_admin then
    return true;
  end if;

  if p_school_id not in (select public.membership_schools(p_uid)) then
    return false;
  end if;

  select public.auth_person_id(p_uid) into person;

  return exists (
    select 1
    from public.authz_member_role_grants g
    join public.authz_role_permissions rp on rp.role_id = g.role_id
    where g.person_id = person
      and g.school_id = p_school_id
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and rp.permission_key = p_key
  )
  or exists (
    -- system role via employment persona / profile: checked in app;
    -- SQL fallback: any active grant OR school_admin already handled
    select 1
    from public.authz_roles r
    join public.authz_role_permissions rp on rp.role_id = r.id
    where r.is_system = true
      and rp.permission_key = p_key
      and r.code in (
        select case
          when e.is_hod then 'hod'
          else coalesce(e.school_persona, 'teacher')
        end
        from public.persons per
        join public.teacher_profiles tp on tp.person_id = per.id
        join public.teacher_employments e on e.teacher_profile_id = tp.id
        where per.auth_user_id = p_uid
          and e.school_id = p_school_id
          and e.status in ('active', 'invited')
        union
        select 'student'
        from public.persons per
        join public.student_profiles sp on sp.person_id = per.id
        join public.student_admissions a on a.student_profile_id = sp.id
        where per.auth_user_id = p_uid
          and a.school_id = p_school_id
          and a.status in ('active', 'alumni')
        union
        select 'parent'
        from public.persons per
        join public.parent_profiles pp on pp.person_id = per.id
        join public.student_parent_links spl on spl.parent_profile_id = pp.id
        join public.student_admissions a on a.student_profile_id = spl.student_profile_id
        where per.auth_user_id = p_uid
          and a.school_id = p_school_id
      )
  );
end;
$$;

revoke all on function public.has_permission(uuid, uuid, text) from public;
grant execute on function public.has_permission(uuid, uuid, text) to authenticated;

-- generated
insert into public.authz_permissions (key, domain, description) values
  ('tenant.school.read', 'tenant', 'tenant.school.read'),
  ('tenant.school.edit', 'tenant', 'tenant.school.edit'),
  ('tenant.school.archive', 'tenant', 'tenant.school.archive'),
  ('access.session.read', 'access', 'access.session.read'),
  ('access.invite.create', 'access', 'access.invite.create'),
  ('access.invite.revoke', 'access', 'access.invite.revoke'),
  ('authz.role.read', 'authz', 'authz.role.read'),
  ('authz.role.grant', 'authz', 'authz.role.grant'),
  ('authz.role.revoke', 'authz', 'authz.role.revoke'),
  ('authz.role.create_custom', 'authz', 'authz.role.create_custom'),
  ('identity.person.read', 'identity', 'identity.person.read'),
  ('identity.person.edit', 'identity', 'identity.person.edit'),
  ('identity.person.create', 'identity', 'identity.person.create'),
  ('workforce.employment.read', 'workforce', 'workforce.employment.read'),
  ('workforce.employment.create', 'workforce', 'workforce.employment.create'),
  ('workforce.employment.edit', 'workforce', 'workforce.employment.edit'),
  ('workforce.employment.archive', 'workforce', 'workforce.employment.archive'),
  ('workforce.teacher.invite', 'workforce', 'workforce.teacher.invite'),
  ('workforce.workspace.read', 'workforce', 'workforce.workspace.read'),
  ('workforce.department.read', 'workforce', 'workforce.department.read'),
  ('workforce.department.edit', 'workforce', 'workforce.department.edit'),
  ('enrollment.admission.read', 'enrollment', 'enrollment.admission.read'),
  ('enrollment.admission.create', 'enrollment', 'enrollment.admission.create'),
  ('enrollment.admission.edit', 'enrollment', 'enrollment.admission.edit'),
  ('enrollment.placement.edit', 'enrollment', 'enrollment.placement.edit'),
  ('config.catalog.read', 'config', 'config.catalog.read'),
  ('config.catalog.edit', 'config', 'config.catalog.edit'),
  ('config.branding.edit', 'config', 'config.branding.edit'),
  ('calendar.year.read', 'calendar', 'calendar.year.read'),
  ('calendar.year.edit', 'calendar', 'calendar.year.edit'),
  ('calendar.year.lock', 'calendar', 'calendar.year.lock'),
  ('calendar.year.unlock', 'calendar', 'calendar.year.unlock'),
  ('calendar.event.read', 'calendar', 'calendar.event.read'),
  ('calendar.event.create', 'calendar', 'calendar.event.create'),
  ('calendar.event.approve', 'calendar', 'calendar.event.approve'),
  ('structure.class.read', 'structure', 'structure.class.read'),
  ('structure.class.edit', 'structure', 'structure.class.edit'),
  ('timetable.grid.read', 'timetable', 'timetable.grid.read'),
  ('timetable.grid.edit', 'timetable', 'timetable.grid.edit'),
  ('timetable.grid.publish', 'timetable', 'timetable.grid.publish'),
  ('assessment.config.read', 'assessment', 'assessment.config.read'),
  ('assessment.config.edit', 'assessment', 'assessment.config.edit'),
  ('assessment.results.read', 'assessment', 'assessment.results.read'),
  ('assessment.results.enter', 'assessment', 'assessment.results.enter'),
  ('assessment.results.publish', 'assessment', 'assessment.results.publish'),
  ('assessment.results.lock', 'assessment', 'assessment.results.lock'),
  ('assessment.results.unlock', 'assessment', 'assessment.results.unlock'),
  ('attendance.record.read', 'attendance', 'attendance.record.read'),
  ('attendance.record.create', 'attendance', 'attendance.record.create'),
  ('attendance.session.approve', 'attendance', 'attendance.session.approve'),
  ('attendance.session.lock', 'attendance', 'attendance.session.lock'),
  ('attendance.leave.decide', 'attendance', 'attendance.leave.decide'),
  ('conduct.incident.read', 'conduct', 'conduct.incident.read'),
  ('conduct.incident.record', 'conduct', 'conduct.incident.record'),
  ('conduct.incident.approve', 'conduct', 'conduct.incident.approve'),
  ('homework.assign', 'homework', 'homework.assign'),
  ('homework.grade', 'homework', 'homework.grade'),
  ('homework.read', 'homework', 'homework.read'),
  ('engagement.event.read', 'engagement', 'engagement.event.read'),
  ('engagement.event.create', 'engagement', 'engagement.event.create'),
  ('engagement.event.approve', 'engagement', 'engagement.event.approve'),
  ('communication.message.read', 'communication', 'communication.message.read'),
  ('communication.message.publish', 'communication', 'communication.message.publish'),
  ('communication.config.edit', 'communication', 'communication.config.edit'),
  ('document.report_card.read', 'document', 'document.report_card.read'),
  ('document.report_card.issue', 'document', 'document.report_card.issue'),
  ('document.template.edit', 'document', 'document.template.edit'),
  ('analytics.dashboard.read', 'analytics', 'analytics.dashboard.read'),
  ('audit.entry.read', 'audit', 'audit.entry.read'),
  ('onboarding.wizard.edit', 'onboarding', 'onboarding.wizard.edit'),
  ('fee.invoice.read', 'fee', 'fee.invoice.read'),
  ('fee.invoice.create', 'fee', 'fee.invoice.create'),
  ('fee.waiver.approve', 'fee', 'fee.waiver.approve'),
  ('payment.read', 'payment', 'payment.read'),
  ('payment.create', 'payment', 'payment.create')
on conflict (key) do nothing;

insert into public.authz_roles (code, name, is_system, school_id)
select v.code, v.name, v.is_system, v.school_id::uuid
from (
  values
    ('school_admin', 'school admin', true, null::uuid),
    ('principal', 'principal', true, null::uuid),
    ('vice_principal', 'vice principal', true, null::uuid),
    ('hod', 'hod', true, null::uuid),
    ('teacher', 'teacher', true, null::uuid),
    ('student', 'student', true, null::uuid),
    ('parent', 'parent', true, null::uuid),
    ('staff', 'staff', true, null::uuid)
) as v(code, name, is_system, school_id)
where not exists (
  select 1 from public.authz_roles r
  where r.is_system = true and r.code = v.code
);

insert into public.authz_role_permissions (role_id, permission_key) values
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'tenant.school.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'tenant.school.archive'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'access.invite.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'access.invite.revoke'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'authz.role.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'authz.role.grant'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'authz.role.revoke'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'authz.role.create_custom'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'identity.person.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.employment.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.employment.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.employment.archive'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.teacher.invite'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.department.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'workforce.department.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'enrollment.admission.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'enrollment.admission.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'enrollment.placement.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'config.catalog.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'config.branding.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.year.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.year.lock'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.year.unlock'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.event.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'calendar.event.approve'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'structure.class.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'structure.class.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'timetable.grid.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'timetable.grid.publish'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.config.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.config.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.results.enter'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.results.publish'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.results.lock'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'assessment.results.unlock'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'attendance.record.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'attendance.session.approve'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'attendance.session.lock'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'attendance.leave.decide'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'conduct.incident.record'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'conduct.incident.approve'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'homework.assign'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'homework.grade'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'engagement.event.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'engagement.event.approve'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'communication.message.publish'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'communication.config.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'document.report_card.issue'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'document.template.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'analytics.dashboard.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'audit.entry.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'onboarding.wizard.edit'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'fee.invoice.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'fee.invoice.create'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'fee.waiver.approve'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'payment.read'),
  ((select id from public.authz_roles where code = 'school_admin' and is_system = true limit 1), 'payment.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'tenant.school.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'access.invite.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'access.invite.revoke'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'authz.role.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'authz.role.grant'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'authz.role.revoke'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'identity.person.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.employment.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.employment.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.employment.archive'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.teacher.invite'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.department.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'workforce.department.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'enrollment.admission.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'enrollment.admission.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'enrollment.placement.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'config.catalog.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'config.branding.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.year.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.year.lock'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.year.unlock'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.event.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'calendar.event.approve'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'structure.class.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'structure.class.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'timetable.grid.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'timetable.grid.publish'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.config.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.config.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.results.enter'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.results.publish'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.results.lock'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'assessment.results.unlock'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'attendance.record.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'attendance.session.approve'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'attendance.session.lock'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'attendance.leave.decide'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'conduct.incident.record'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'conduct.incident.approve'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'homework.assign'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'homework.grade'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'engagement.event.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'engagement.event.approve'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'communication.message.publish'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'communication.config.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'document.report_card.issue'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'document.template.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'analytics.dashboard.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'audit.entry.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'onboarding.wizard.edit'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'fee.invoice.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'fee.invoice.create'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'fee.waiver.approve'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'payment.read'),
  ((select id from public.authz_roles where code = 'principal' and is_system = true limit 1), 'payment.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'access.invite.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'access.invite.revoke'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'authz.role.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'identity.person.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.employment.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.employment.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.employment.archive'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.teacher.invite'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.department.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'workforce.department.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'enrollment.admission.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'enrollment.admission.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'enrollment.placement.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'config.catalog.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'config.branding.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'calendar.year.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'calendar.event.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'calendar.event.approve'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'structure.class.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'structure.class.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'timetable.grid.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'timetable.grid.publish'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.config.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.config.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.results.enter'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.results.publish'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'assessment.results.lock'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'attendance.record.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'attendance.session.approve'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'attendance.session.lock'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'attendance.leave.decide'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'conduct.incident.record'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'conduct.incident.approve'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'homework.assign'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'homework.grade'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'engagement.event.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'engagement.event.approve'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'communication.message.publish'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'communication.config.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'document.report_card.issue'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'document.template.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'analytics.dashboard.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'audit.entry.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'onboarding.wizard.edit'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'fee.invoice.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'fee.invoice.create'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'fee.waiver.approve'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'payment.read'),
  ((select id from public.authz_roles where code = 'vice_principal' and is_system = true limit 1), 'payment.create'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'workforce.employment.edit'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'workforce.department.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'workforce.department.edit'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'structure.class.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'timetable.grid.edit'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'assessment.config.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'assessment.results.enter'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'assessment.results.publish'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'assessment.results.lock'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'attendance.record.create'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'attendance.session.approve'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'conduct.incident.record'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'conduct.incident.approve'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'homework.assign'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'homework.grade'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'communication.message.publish'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'hod' and is_system = true limit 1), 'analytics.dashboard.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'workforce.department.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'structure.class.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'assessment.config.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'assessment.results.enter'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'attendance.record.create'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'conduct.incident.record'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'homework.assign'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'homework.grade'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'teacher' and is_system = true limit 1), 'analytics.dashboard.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'timetable.grid.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'payment.create'),
  ((select id from public.authz_roles where code = 'student' and is_system = true limit 1), 'payment.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'enrollment.admission.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'assessment.results.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'attendance.record.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'homework.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'conduct.incident.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'engagement.event.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'communication.message.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'document.report_card.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'fee.invoice.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'payment.read'),
  ((select id from public.authz_roles where code = 'parent' and is_system = true limit 1), 'payment.create'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'tenant.school.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'access.session.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'identity.person.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'identity.person.edit'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'workforce.employment.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'workforce.workspace.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'config.catalog.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'calendar.year.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'calendar.event.read'),
  ((select id from public.authz_roles where code = 'staff' and is_system = true limit 1), 'communication.message.read')
on conflict do nothing;
