-- Phase 3: Grade Calculation Engine (E33)
-- Deterministic, auditable grade runs from E31 frameworks + E32 marks.
-- Teachers never calculate grades manually.

-- ---------------------------------------------------------------------------
-- 1. Configuration: grace, optional subjects, exemptions
-- ---------------------------------------------------------------------------

create table public.grade_calculation_grace_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  rules jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.grade_calculation_grace_rules.rules is
  'e.g. { max_grace_marks, apply_to: failing_only|all, ceiling_percent }';

create unique index grade_calculation_grace_rules_school_code_uidx
  on public.grade_calculation_grace_rules (school_id, lower(code))
  where archived_at is null;

create table public.grade_calculation_optional_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  include_in_overall boolean not null default false,
  weight_override_percent numeric(5, 2)
    check (
      weight_override_percent is null
      or (weight_override_percent >= 0 and weight_override_percent <= 100)
    ),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index grade_calculation_optional_subjects_active_uidx
  on public.grade_calculation_optional_subjects (
    school_id, academic_year_id, class_id, subject_id
  )
  where archived_at is null;

create table public.grade_calculation_exemptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  framework_category_id uuid
    references public.assessment_framework_categories (id) on delete set null,
  assessment_record_id uuid
    references public.assessment_records (id) on delete set null,
  exemption_kind text not null
    check (
      exemption_kind in (
        'absent_excused',
        'medical',
        'optional_subject',
        'custom'
      )
    ),
  reason text,
  granted_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grade_calculation_exemptions_student_idx
  on public.grade_calculation_exemptions (student_profile_id, academic_year_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Runs + results
-- ---------------------------------------------------------------------------

create table public.grade_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  section_id uuid references public.sections (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  assessment_framework_id uuid
    references public.assessment_frameworks (id) on delete set null,
  assessment_framework_version_id uuid
    references public.assessment_framework_versions (id) on delete set null,
  formula_id uuid
    references public.assessment_framework_formulas (id) on delete set null,
  scope text not null
    check (scope in ('subject', 'term', 'overall')),
  run_version integer not null default 1 check (run_version >= 1),
  status text not null default 'computed'
    check (status in ('computed', 'published', 'superseded')),
  input_snapshot jsonb not null default '{}'::jsonb,
  inputs_fingerprint text not null,
  change_summary text,
  is_current boolean not null default true,
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.grade_calculation_runs is
  'E33 — reproducible grade compute. input_snapshot + fingerprint make results auditable.';

create index grade_calculation_runs_current_idx
  on public.grade_calculation_runs (school_id, academic_year_id, class_id, scope)
  where is_current = true;

create table public.grade_calculation_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  run_id uuid not null references public.grade_calculation_runs (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete restrict,
  result_kind text not null
    check (result_kind in ('subject', 'term', 'overall')),
  subject_id uuid references public.subjects (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  final_marks numeric(10, 4),
  max_marks numeric(10, 4),
  percentage numeric(8, 4),
  letter_grade text,
  grade_points numeric(8, 4),
  pass_status text
    check (pass_status is null or pass_status in ('pass', 'fail', 'exempt', 'incomplete')),
  grace_applied numeric(8, 4) not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create index grade_calculation_results_run_idx
  on public.grade_calculation_results (run_id)
  where is_current = true;

create index grade_calculation_results_student_idx
  on public.grade_calculation_results (student_profile_id, result_kind)
  where is_current = true;

-- ---------------------------------------------------------------------------
-- 3. Audit
-- ---------------------------------------------------------------------------

create table public.grade_calculation_audit_log (
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

create index grade_calculation_audit_log_school_idx
  on public.grade_calculation_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'grade_calculation_grace_rules',
    'grade_calculation_optional_subjects',
    'grade_calculation_exemptions',
    'grade_calculation_runs',
    'grade_calculation_results',
    'grade_calculation_audit_log'
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
-- 5. AuthZ
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  ('grade_calculation.read', 'grade_calculation', 'Read grade calculation runs and results'),
  ('grade_calculation.configure', 'grade_calculation', 'Configure grace, optional subjects, exemptions'),
  ('grade_calculation.run', 'grade_calculation', 'Execute grade calculations'),
  ('grade_calculation.publish', 'grade_calculation', 'Publish calculated results')
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('grade_calculation.read'),
    ('grade_calculation.configure'),
    ('grade_calculation.run'),
    ('grade_calculation.publish')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'grade_calculation.read'
from public.authz_roles r
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;
