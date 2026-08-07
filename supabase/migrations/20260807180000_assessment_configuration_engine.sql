-- Phase 1: Assessment Configuration Engine (E11 config surface)
-- Definitions, types, categories, components, publish/lock rules.
-- NO marks / results tables in this migration.

-- ---------------------------------------------------------------------------
-- 1. Exam types (admin-configurable catalog)
-- ---------------------------------------------------------------------------

create table public.assessment_exam_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  default_weightage_percent numeric(5, 2),
  default_max_marks numeric(8, 2),
  default_pass_marks numeric(8, 2),
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    default_weightage_percent is null
    or (default_weightage_percent >= 0 and default_weightage_percent <= 100)
  ),
  check (default_max_marks is null or default_max_marks > 0),
  check (
    default_pass_marks is null
    or default_max_marks is null
    or default_pass_marks <= default_max_marks
  )
);

comment on table public.assessment_exam_types is
  'E11 admin exam-type catalog (Unit Test, Midterm…). Not marks.';

create unique index assessment_exam_types_school_active_code_unique_idx
  on public.assessment_exam_types (school_id, lower(code))
  where archived_at is null;

create unique index assessment_exam_types_school_active_name_unique_idx
  on public.assessment_exam_types (school_id, lower(name))
  where archived_at is null;

alter table public.assessment_exam_types enable row level security;
revoke all on public.assessment_exam_types from anon;
grant select, insert, update on public.assessment_exam_types to authenticated;

create policy assessment_exam_types_own on public.assessment_exam_types
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Assessment categories
-- ---------------------------------------------------------------------------

create table public.assessment_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null default 'theory',
  description text,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    kind in (
      'theory',
      'internal',
      'practical',
      'project',
      'oral',
      'optional',
      'other'
    )
  )
);

comment on table public.assessment_categories is
  'E11 assessment category catalog (Internal, Practical, Project…).';

create unique index assessment_categories_school_active_code_unique_idx
  on public.assessment_categories (school_id, lower(code))
  where archived_at is null;

create unique index assessment_categories_school_active_name_unique_idx
  on public.assessment_categories (school_id, lower(name))
  where archived_at is null;

alter table public.assessment_categories enable row level security;
revoke all on public.assessment_categories from anon;
grant select, insert, update on public.assessment_categories to authenticated;

create policy assessment_categories_own on public.assessment_categories
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. School / year assessment policy (publish + lock defaults)
-- ---------------------------------------------------------------------------

create table public.assessment_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  default_pass_percent numeric(5, 2) not null default 33,
  default_grading_scale_id uuid references public.grading_scales (id) on delete set null,
  publish_rules jsonb not null default '{}'::jsonb,
  lock_rules jsonb not null default '{}'::jsonb,
  moderation_enabled boolean not null default false,
  ai_evaluation_enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (default_pass_percent >= 0 and default_pass_percent <= 100)
);

comment on table public.assessment_policies is
  'E11 school/year assessment defaults. Null academic_year_id = school-wide.';
comment on column public.assessment_policies.publish_rules is
  'JSON: visible_to_parents, visible_to_students, require_schedules, auto_lock_on_publish, …';
comment on column public.assessment_policies.lock_rules is
  'JSON: lock_on_publish, prevent_edit_when_locked, prevent_archive_when_locked, …';
comment on column public.assessment_policies.moderation_enabled is
  'FUTURE moderation workflow flag.';
comment on column public.assessment_policies.ai_evaluation_enabled is
  'FUTURE AI evaluation flag.';

create unique index assessment_policies_school_default_unique_idx
  on public.assessment_policies (school_id)
  where academic_year_id is null;

create unique index assessment_policies_year_unique_idx
  on public.assessment_policies (school_id, academic_year_id)
  where academic_year_id is not null;

alter table public.assessment_policies enable row level security;
revoke all on public.assessment_policies from anon;
grant select, insert, update on public.assessment_policies to authenticated;

create policy assessment_policies_own on public.assessment_policies
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Enrich exam_definitions (configuration only)
-- ---------------------------------------------------------------------------

alter table public.exam_definitions
  add column if not exists exam_type_id uuid
    references public.assessment_exam_types (id) on delete set null,
  add column if not exists assessment_category_id uuid
    references public.assessment_categories (id) on delete set null,
  add column if not exists pass_marks numeric(8, 2),
  add column if not exists grading_scale_version_id uuid
    references public.grading_scale_versions (id) on delete set null,
  add column if not exists subject_group_id uuid
    references public.subject_groups (id) on delete set null,
  add column if not exists includes_optional_subjects boolean not null default false,
  add column if not exists publishing_status text not null default 'draft',
  add column if not exists publish_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists publish_rules jsonb not null default '{}'::jsonb,
  add column if not exists lock_rules jsonb not null default '{}'::jsonb,
  add column if not exists moderation_enabled boolean not null default false,
  add column if not exists ai_evaluation_enabled boolean not null default false,
  add column if not exists description text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Expand legacy category check to include internal/practical aliases
alter table public.exam_definitions
  drop constraint if exists exam_definitions_category_check;

alter table public.exam_definitions
  add constraint exam_definitions_category_check
  check (
    category in (
      'unit_test',
      'quiz',
      'midterm',
      'final',
      'oral',
      'project',
      'internal',
      'practical',
      'other'
    )
  );

alter table public.exam_definitions
  drop constraint if exists exam_definitions_publishing_status_chk;

alter table public.exam_definitions
  add constraint exam_definitions_publishing_status_chk
  check (
    publishing_status in (
      'draft',
      'scheduled',
      'published',
      'locked',
      'retracted'
    )
  );

alter table public.exam_definitions
  drop constraint if exists exam_definitions_pass_marks_chk;

alter table public.exam_definitions
  add constraint exam_definitions_pass_marks_chk
  check (
    pass_marks is null
    or max_marks is null
    or pass_marks <= max_marks
  );

comment on column public.exam_definitions.publishing_status is
  'E11 config lifecycle: draft → scheduled → published → locked. Not marks entry.';
comment on column public.exam_definitions.grading_scale_version_id is
  'Pins E07 grading_scale_versions for this assessment definition.';
comment on column public.exam_definitions.subject_group_id is
  'Optional E07 subject group scope for this assessment.';

-- Active-name unique (allow archived reuse)
drop index if exists public.exam_definitions_year_name_unique_idx;
create unique index exam_definitions_year_active_name_unique_idx
  on public.exam_definitions (academic_year_id, lower(name))
  where archived_at is null;

create index exam_definitions_type_idx
  on public.exam_definitions (exam_type_id)
  where exam_type_id is not null and archived_at is null;

create index exam_definitions_status_idx
  on public.exam_definitions (academic_year_id, publishing_status)
  where archived_at is null;

revoke delete on public.exam_definitions from authenticated;
grant select, insert, update on public.exam_definitions to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Assessment components (internal / practical / project breakdown)
-- ---------------------------------------------------------------------------

create table public.assessment_components (
  id uuid primary key default gen_random_uuid(),
  exam_definition_id uuid not null references public.exam_definitions (id) on delete restrict,
  component_type text not null,
  name text not null,
  weightage_percent numeric(5, 2),
  max_marks numeric(8, 2),
  pass_marks numeric(8, 2),
  is_optional boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    component_type in (
      'theory',
      'practical',
      'internal',
      'project',
      'oral',
      'other'
    )
  ),
  check (
    weightage_percent is null
    or (weightage_percent >= 0 and weightage_percent <= 100)
  ),
  check (max_marks is null or max_marks > 0),
  check (
    pass_marks is null
    or max_marks is null
    or pass_marks <= max_marks
  )
);

comment on table public.assessment_components is
  'E11 component breakdown within an exam definition (theory/practical/internal/project). Config only.';

create unique index assessment_components_exam_active_name_unique_idx
  on public.assessment_components (exam_definition_id, lower(name))
  where archived_at is null;

create index assessment_components_exam_idx
  on public.assessment_components (exam_definition_id, display_order)
  where archived_at is null;

alter table public.assessment_components enable row level security;
revoke all on public.assessment_components from anon;
grant select, insert, update on public.assessment_components to authenticated;

create policy assessment_components_own on public.assessment_components
  for all to authenticated
  using (
    exam_definition_id in (
      select ed.id from public.exam_definitions ed
      join public.academic_years ay on ay.id = ed.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    exam_definition_id in (
      select ed.id from public.exam_definitions ed
      join public.academic_years ay on ay.id = ed.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Enrich exam_subject_schedules (still schedule/config — not marks)
-- ---------------------------------------------------------------------------

alter table public.exam_subject_schedules
  add column if not exists pass_marks numeric(8, 2),
  add column if not exists is_optional_subject boolean not null default false,
  add column if not exists component_type text,
  add column if not exists grading_scale_version_id uuid
    references public.grading_scale_versions (id) on delete set null,
  add column if not exists scheduled_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.exam_subject_schedules
  drop constraint if exists exam_subject_schedules_component_type_chk;

alter table public.exam_subject_schedules
  add constraint exam_subject_schedules_component_type_chk
  check (
    component_type is null
    or component_type in (
      'theory',
      'practical',
      'internal',
      'project',
      'oral',
      'other'
    )
  );

comment on column public.exam_subject_schedules.is_optional_subject is
  'When true, subject is optional for this assessment instance.';

revoke delete on public.exam_subject_schedules from authenticated;
grant select, insert, update on public.exam_subject_schedules to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Seed default exam types + categories for existing schools
-- ---------------------------------------------------------------------------

insert into public.assessment_exam_types (
  school_id, code, name, default_weightage_percent, default_max_marks, default_pass_marks, display_order
)
select s.id, t.code, t.name, t.weightage, t.max_marks, t.pass_marks, t.ord
from public.schools s
cross join (
  values
    ('UNIT', 'Unit test', 10::numeric, 40::numeric, 13::numeric, 1),
    ('QUIZ', 'Quiz', 5, 20, 7, 2),
    ('MID', 'Midterm', 30, 80, 26, 3),
    ('FINAL', 'Final', 40, 100, 33, 4),
    ('ORAL', 'Oral', 10, 25, 8, 5),
    ('PROJ', 'Project', 15, 50, 17, 6),
    ('INT', 'Internal assessment', 20, 40, 13, 7),
    ('PRAC', 'Practical', 20, 30, 10, 8)
) as t(code, name, weightage, max_marks, pass_marks, ord)
where not exists (
  select 1 from public.assessment_exam_types x
  where x.school_id = s.id and lower(x.code) = lower(t.code)
);

insert into public.assessment_categories (
  school_id, code, name, kind, display_order
)
select s.id, c.code, c.name, c.kind, c.ord
from public.schools s
cross join (
  values
    ('THEORY', 'Theory', 'theory', 1),
    ('INTERNAL', 'Internal', 'internal', 2),
    ('PRACTICAL', 'Practical', 'practical', 3),
    ('PROJECT', 'Project', 'project', 4),
    ('ORAL', 'Oral', 'oral', 5),
    ('OPTIONAL', 'Optional subjects', 'optional', 6)
) as c(code, name, kind, ord)
where not exists (
  select 1 from public.assessment_categories x
  where x.school_id = s.id and lower(x.code) = lower(c.code)
);
