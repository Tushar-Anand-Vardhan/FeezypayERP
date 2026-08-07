-- Phase 3: Assessment Framework Engine (E31)
-- Year×class×subject evaluation plans with categories, formulas, publish versions.
-- Teachers do not design frameworks — admin leadership only.

-- ---------------------------------------------------------------------------
-- 1. Root frameworks
-- ---------------------------------------------------------------------------

create table public.assessment_frameworks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  cloned_from_framework_id uuid references public.assessment_frameworks (id) on delete set null,
  cloned_from_version_id uuid,
  cloned_at timestamptz,
  cloned_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assessment_frameworks is
  'E31 Assessment Framework — year×class×subject evaluation plan. Teachers do not author.';

create unique index assessment_frameworks_active_year_class_subject_uidx
  on public.assessment_frameworks (school_id, academic_year_id, class_id, subject_id)
  where archived_at is null;

create unique index assessment_frameworks_school_active_code_uidx
  on public.assessment_frameworks (school_id, lower(code))
  where archived_at is null;

create index assessment_frameworks_school_year_idx
  on public.assessment_frameworks (school_id, academic_year_id)
  where archived_at is null;

alter table public.assessment_frameworks enable row level security;
revoke all on public.assessment_frameworks from anon;
grant select, insert, update on public.assessment_frameworks to authenticated;

create policy assessment_frameworks_own on public.assessment_frameworks
  for all to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. Versions
-- ---------------------------------------------------------------------------

create table public.assessment_framework_versions (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.assessment_frameworks (id) on delete restrict,
  version integer not null check (version >= 1),
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text,
  published_at timestamptz,
  is_immutable boolean not null default false,
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (framework_id, version)
);

comment on table public.assessment_framework_versions is
  'E31 — immutable published framework snapshots (strategy V). No DELETE.';

create index assessment_framework_versions_current_idx
  on public.assessment_framework_versions (framework_id)
  where is_current = true;

alter table public.assessment_frameworks
  add constraint assessment_frameworks_cloned_from_version_fk
  foreign key (cloned_from_version_id)
  references public.assessment_framework_versions (id) on delete set null;

alter table public.assessment_framework_versions enable row level security;
revoke all on public.assessment_framework_versions from anon;
grant select, insert, update on public.assessment_framework_versions to authenticated;

create policy assessment_framework_versions_own on public.assessment_framework_versions
  for all to authenticated
  using (
    framework_id in (
      select id from public.assessment_frameworks
      where school_id in (select public.membership_schools(auth.uid()))
    )
  )
  with check (
    framework_id in (
      select id from public.assessment_frameworks
      where school_id in (select public.membership_schools(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Categories
-- ---------------------------------------------------------------------------

create table public.assessment_framework_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  framework_id uuid not null references public.assessment_frameworks (id) on delete cascade,
  assessment_category_id uuid references public.assessment_categories (id) on delete set null,
  code text,
  name text not null,
  category_kind text not null default 'custom'
    check (
      category_kind in (
        'term_exam',
        'half_yearly',
        'final',
        'periodic_test',
        'notebook',
        'classwork',
        'practical',
        'project',
        'viva',
        'observation',
        'internal_assessment',
        'activity',
        'custom'
      )
    ),
  description text,
  weightage_percent numeric(5, 2)
    check (
      weightage_percent is null
      or (weightage_percent >= 0 and weightage_percent <= 100)
    ),
  max_marks numeric(8, 2) check (max_marks is null or max_marks > 0),
  pass_marks numeric(8, 2),
  grade_mapping jsonb not null default '{}'::jsonb,
  grading_scale_version_id uuid,
  included_in_final_grade boolean not null default true,
  term_id uuid references public.terms (id) on delete set null,
  visibility text not null default 'teachers'
    check (
      visibility in ('internal', 'teachers', 'students', 'parents', 'all')
    ),
  report_card_mapping jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    pass_marks is null
    or max_marks is null
    or pass_marks <= max_marks
  )
);

create index assessment_framework_categories_framework_idx
  on public.assessment_framework_categories (framework_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 4. Formulas + parts
-- ---------------------------------------------------------------------------

create table public.assessment_framework_formulas (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  framework_id uuid not null references public.assessment_frameworks (id) on delete cascade,
  code text,
  name text not null,
  description text,
  term_id uuid references public.terms (id) on delete set null,
  formula_kind text not null default 'weighted_sum'
    check (formula_kind in ('weighted_sum', 'custom')),
  expression jsonb not null default '{}'::jsonb,
  is_final_grade boolean not null default false,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessment_framework_formulas_framework_idx
  on public.assessment_framework_formulas (framework_id)
  where archived_at is null;

create table public.assessment_framework_formula_parts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  framework_id uuid not null references public.assessment_frameworks (id) on delete cascade,
  formula_id uuid not null references public.assessment_framework_formulas (id) on delete cascade,
  category_id uuid not null references public.assessment_framework_categories (id) on delete cascade,
  weight_percent numeric(5, 2) not null
    check (weight_percent >= 0 and weight_percent <= 100),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index assessment_framework_formula_parts_active_uidx
  on public.assessment_framework_formula_parts (formula_id, category_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 5. Audit
-- ---------------------------------------------------------------------------

create table public.assessment_framework_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  actor_auth_user_id uuid references auth.users (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assessment_framework_audit_log_school_idx
  on public.assessment_framework_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. RLS for school-scoped children
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'assessment_framework_categories',
    'assessment_framework_formulas',
    'assessment_framework_formula_parts',
    'assessment_framework_audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'grant select, insert, update on public.%I to authenticated',
      t
    );
    execute format(
      'create policy %I_own on public.%I for all to authenticated
         using (school_id in (select public.membership_schools(auth.uid())))
         with check (school_id in (select public.membership_schools(auth.uid())))',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. AuthZ
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  ('assessment_framework.read', 'assessment_framework', 'Read assessment frameworks and published versions'),
  ('assessment_framework.edit', 'assessment_framework', 'Create/update frameworks, categories, and formulas'),
  ('assessment_framework.publish', 'assessment_framework', 'Publish framework to immutable version'),
  ('assessment_framework.archive', 'assessment_framework', 'Archive or retire frameworks'),
  ('assessment_framework.clone', 'assessment_framework', 'Clone framework to another year/class/subject')
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('assessment_framework.read'),
    ('assessment_framework.edit'),
    ('assessment_framework.publish'),
    ('assessment_framework.archive'),
    ('assessment_framework.clone')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'assessment_framework.read'
from public.authz_roles r
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;
