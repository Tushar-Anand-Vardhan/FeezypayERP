-- Phase 3: Report Card Engine enhancement (E20)
-- Template designer blocks + teacher field assignments + lock lifecycle.
-- Prefer E33 published grade runs; never duplicate academic OLTP.

-- ---------------------------------------------------------------------------
-- 1. Expand template block types (designer surface)
-- ---------------------------------------------------------------------------

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
  where con.conrelid = 'public.report_card_template_blocks'::regclass
    and con.contype = 'c'
    and a.attname = 'block_type'
  limit 1;
  if cname is not null then
    execute format(
      'alter table public.report_card_template_blocks drop constraint %I',
      cname
    );
  end if;
end $$;

alter table public.report_card_template_blocks
  add constraint report_card_template_blocks_block_type_check
  check (
    block_type in (
      'header',
      'student_info',
      'grades',
      'grade_summary',
      'remarks',
      'attendance',
      'co_curricular',
      'achievements',
      'behaviour',
      'curriculum',
      'observations',
      'promotion',
      'teacher_comments',
      'principal_comments',
      'signatures',
      'custom',
      'spacer'
    )
  );

alter table public.report_card_templates
  add column if not exists include_achievements boolean not null default true,
  add column if not exists include_behaviour boolean not null default true,
  add column if not exists include_curriculum boolean not null default true,
  add column if not exists include_observations boolean not null default true,
  add column if not exists include_promotion boolean not null default true,
  add column if not exists prefer_grade_calculation boolean not null default true;

comment on column public.report_card_templates.prefer_grade_calculation is
  'When true, assemble grades from published E33 results (fallback E11).';

-- ---------------------------------------------------------------------------
-- 2. Template field assignments (teachers fill only assigned fields)
-- ---------------------------------------------------------------------------

create table public.report_card_template_field_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  template_id uuid not null references public.report_card_templates (id) on delete cascade,
  field_key text not null,
  field_label text not null,
  assignee_role text not null default 'teacher'
    check (
      assignee_role in (
        'teacher',
        'class_teacher',
        'subject_teacher',
        'hod',
        'principal',
        'vice_principal',
        'admin'
      )
    ),
  subject_id uuid references public.subjects (id) on delete set null,
  required boolean not null default false,
  max_length integer not null default 5000 check (max_length > 0 and max_length <= 20000),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_card_template_field_assignments is
  'E20 template designer: which narrative fields teachers/admins fill. Academic facts stay in source engines.';

create unique index report_card_template_field_assignments_active_uidx
  on public.report_card_template_field_assignments (template_id, lower(field_key))
  where archived_at is null;

create index report_card_template_field_assignments_template_idx
  on public.report_card_template_field_assignments (template_id, display_order)
  where archived_at is null;

alter table public.report_card_template_field_assignments enable row level security;
revoke all on public.report_card_template_field_assignments from anon;
grant select, insert, update on public.report_card_template_field_assignments to authenticated;

create policy report_card_template_field_assignments_own
  on public.report_card_template_field_assignments
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Issue lifecycle: published + locked (+ legacy issued)
-- ---------------------------------------------------------------------------

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
  where con.conrelid = 'public.report_card_issues'::regclass
    and con.contype = 'c'
    and a.attname = 'status'
  limit 1;
  if cname is not null then
    execute format('alter table public.report_card_issues drop constraint %I', cname);
  end if;

  select con.conname into cname
  from pg_constraint con
  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
  where con.conrelid = 'public.report_card_issue_versions'::regclass
    and con.contype = 'c'
    and a.attname = 'status'
  limit 1;
  if cname is not null then
    execute format(
      'alter table public.report_card_issue_versions drop constraint %I',
      cname
    );
  end if;
end $$;

alter table public.report_card_issues
  add constraint report_card_issues_status_check
  check (status in ('draft', 'published', 'locked', 'issued', 'revoked'));

alter table public.report_card_issues
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null;

comment on column public.report_card_issues.status is
  'draft → published (legacy: issued) → locked. revoked terminal. Historical versions on report_card_issue_versions.';

alter table public.report_card_issue_versions
  add constraint report_card_issue_versions_status_check
  check (
    status in (
      'draft',
      'published',
      'locked',
      'issued',
      'superseded',
      'revoked'
    )
  );

alter table public.report_card_issue_versions
  add column if not exists grade_calculation_run_ids uuid[] not null default '{}',
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists field_values jsonb not null default '{}'::jsonb;

comment on column public.report_card_issue_versions.grade_calculation_run_ids is
  'Pinned published E33 run ids used at assemble — not a marks store.';

comment on column public.report_card_issue_versions.field_values is
  'Teacher-filled narrative fields keyed by field_key. Academic facts remain in source engines.';

-- ---------------------------------------------------------------------------
-- 4. AuthZ: teachers may fill assigned fields
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  (
    'document.report_card.fill',
    'document',
    'Fill assigned report-card narrative fields (teachers)'
  ),
  (
    'document.report_card.lock',
    'document',
    'Lock published report cards against further edits'
  )
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('document.report_card.fill'),
    ('document.report_card.lock')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'document.report_card.fill'
from public.authz_roles r
where r.is_system = true
  and r.code in ('hod', 'teacher')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'document.report_card.lock'
from public.authz_roles r
where r.is_system = true
  and r.code = 'hod'
on conflict do nothing;
