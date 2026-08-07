-- Phase 1: School Policy Engine (E07 Configuration policy surface)
-- Versioned school policies for attendance, promotion, timings, leave, exams, behaviour.
-- Fee / transport kinds stubbed for future rule schemas.
-- Runtime attendance/marks/placement facts remain owned by E12/E11/E06.

-- ---------------------------------------------------------------------------
-- 1. Policies (one document per kind × school × optional year)
-- ---------------------------------------------------------------------------

create table public.school_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  policy_kind text not null,
  code text not null,
  name text not null,
  description text,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  status text not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    policy_kind in (
      'attendance_rules',
      'promotion_rules',
      'working_hours',
      'school_timings',
      'leave_types',
      'late_arrival',
      'half_day',
      'exam_eligibility',
      'grace_marks',
      'behaviour_rules',
      'fee_rules',
      'transport_rules'
    )
  ),
  check (status in ('draft', 'published', 'retired'))
);

comment on table public.school_policies is
  'E07 School Policy Engine — versioned admin policies. Consumers: E08–E13/E15.';
comment on column public.school_policies.policy_kind is
  'fee_rules / transport_rules are FUTURE stubs (schema allowed; runtime not wired).';
comment on column public.school_policies.academic_year_id is
  'Null = school-wide default policy for the kind.';

create unique index school_policies_school_kind_year_active_unique_idx
  on public.school_policies (
    school_id,
    policy_kind,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

create unique index school_policies_school_active_code_unique_idx
  on public.school_policies (school_id, lower(code))
  where archived_at is null;

create index school_policies_kind_idx
  on public.school_policies (school_id, policy_kind)
  where archived_at is null;

alter table public.school_policies enable row level security;
revoke all on public.school_policies from anon;
grant select, insert, update on public.school_policies to authenticated;

create policy school_policies_own on public.school_policies
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Policy versions (immutable after publish)
-- ---------------------------------------------------------------------------

create table public.school_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.school_policies (id) on delete restrict,
  version integer not null check (version >= 1),
  rules jsonb not null default '{}'::jsonb,
  effective_from date,
  effective_to date,
  change_summary text,
  published_at timestamptz,
  is_immutable boolean not null default false,
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, version),
  check (
    effective_to is null
    or effective_from is null
    or effective_to >= effective_from
  )
);

comment on table public.school_policy_versions is
  'E07 immutable policy versions. Runtime engines pin or read is_current.';
comment on column public.school_policy_versions.rules is
  'Kind-specific JSON rules. Never store attendance/marks facts here.';
comment on column public.school_policy_versions.is_current is
  'At most one current published version per policy.';

create unique index school_policy_versions_current_unique_idx
  on public.school_policy_versions (policy_id)
  where is_current = true;

create index school_policy_versions_policy_idx
  on public.school_policy_versions (policy_id, version desc);

alter table public.school_policy_versions enable row level security;
revoke all on public.school_policy_versions from anon;
grant select, insert, update on public.school_policy_versions to authenticated;

create policy school_policy_versions_own on public.school_policy_versions
  for all to authenticated
  using (
    policy_id in (
      select id from public.school_policies
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    policy_id in (
      select id from public.school_policies
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Seed default school-wide policies (draft v1) for existing schools
-- ---------------------------------------------------------------------------

insert into public.school_policies (
  school_id, policy_kind, code, name, description, status
)
select
  s.id,
  k.kind,
  k.code,
  k.name,
  k.description,
  'draft'
from public.schools s
cross join (
  values
    ('attendance_rules', 'ATT-RULES', 'Attendance rules', 'Minimum attendance and absence thresholds'),
    ('promotion_rules', 'PROM-RULES', 'Promotion rules', 'Class advancement criteria'),
    ('working_hours', 'WORK-HRS', 'Working hours', 'Staff/instructional working hours'),
    ('school_timings', 'SCH-TIME', 'School timings', 'Daily open/close bell timings'),
    ('leave_types', 'LEAVE-TYPES', 'Leave types', 'Configurable leave categories'),
    ('late_arrival', 'LATE-ARR', 'Late arrival', 'Late mark thresholds and grace'),
    ('half_day', 'HALF-DAY', 'Half day', 'Half-day attendance thresholds'),
    ('exam_eligibility', 'EXAM-ELIG', 'Exam eligibility', 'Attendance/fee gates for exams'),
    ('grace_marks', 'GRACE-MARKS', 'Grace marks', 'Grace mark limits and applicability'),
    ('behaviour_rules', 'BEHAV-RULES', 'Behaviour rules', 'Conduct / behaviour policy thresholds'),
    ('fee_rules', 'FEE-RULES', 'Fee rules (future)', 'FUTURE fee policy stub'),
    ('transport_rules', 'TRANSP-RULES', 'Transport rules (future)', 'FUTURE transport policy stub')
) as k(kind, code, name, description)
where not exists (
  select 1 from public.school_policies p
  where p.school_id = s.id
    and p.policy_kind = k.kind
    and p.academic_year_id is null
    and p.archived_at is null
);

insert into public.school_policy_versions (
  policy_id, version, rules, is_immutable, is_current, change_summary
)
select
  p.id,
  1,
  '{}'::jsonb,
  false,
  false,
  'Seeded draft'
from public.school_policies p
where not exists (
  select 1 from public.school_policy_versions v where v.policy_id = p.id
);
