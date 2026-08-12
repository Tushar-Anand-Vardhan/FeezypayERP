-- Wave 6: career prefs, self-leave permission, platform operators.

alter table public.teacher_profiles
  add column if not exists preferred_subjects text[] not null default '{}',
  add column if not exists preferred_standards text;

comment on column public.teacher_profiles.preferred_subjects is
  'Teacher-declared preferred subject names/codes (career profile).';
comment on column public.teacher_profiles.preferred_standards is
  'Preferred grade/standards text (e.g. Classes 6–8).';

-- AuthZ keys
insert into public.authz_permissions (key, domain, description) values
  ('workforce.employment.self_end', 'workforce', 'End own employment at active school'),
  ('platform.tenant.read', 'platform', 'List schools / cross-tenant health (platform operators)'),
  ('platform.impersonate', 'platform', 'Break-glass into a school context with audit')
on conflict (key) do nothing;

-- Grant self_end to teacher + hod system roles
insert into public.authz_role_permissions (role_id, permission_key)
select r.id, k.key
from public.authz_roles r
cross join (values
  ('workforce.employment.self_end')
) as k(key)
where r.is_system = true
  and r.code in ('teacher', 'hod', 'school_admin', 'principal', 'vice_principal')
on conflict (role_id, permission_key) do nothing;

-- Platform operators (global, not school-scoped)
create table if not exists public.platform_operators (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  can_impersonate boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  operator_person_id uuid not null references public.persons (id) on delete restrict,
  action text not null,
  school_id uuid references public.schools (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);

alter table public.platform_operators enable row level security;
alter table public.platform_audit_log enable row level security;

revoke all on public.platform_operators from anon;
revoke all on public.platform_audit_log from anon;

grant select on public.platform_operators to authenticated;
grant insert on public.platform_audit_log to authenticated;
grant select, insert, update on public.platform_operators to service_role;
grant select, insert on public.platform_audit_log to service_role;

drop policy if exists platform_operators_self on public.platform_operators;
create policy platform_operators_self on public.platform_operators
  for select to authenticated
  using (auth_user_id = auth.uid() and archived_at is null);

drop policy if exists platform_audit_insert_own on public.platform_audit_log;
create policy platform_audit_insert_own on public.platform_audit_log
  for insert to authenticated
  with check (
    operator_person_id in (
      select id from public.persons where auth_user_id = auth.uid()
    )
  );

drop policy if exists platform_audit_read_own on public.platform_audit_log;
create policy platform_audit_read_own on public.platform_audit_log
  for select to authenticated
  using (
    operator_person_id in (
      select id from public.persons where auth_user_id = auth.uid()
    )
  );
