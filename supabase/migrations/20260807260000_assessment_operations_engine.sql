-- Phase 2: Assessment Operations Engine (E11 marks)
-- Enriches exam_results; mark sessions; teacher-created assessments; audit.
-- Append/correct only — never silent overwrite of historical meaning.

-- ---------------------------------------------------------------------------
-- 1. Exam definitions — teacher origin + operational kind
-- ---------------------------------------------------------------------------

alter table public.exam_definitions
  add column if not exists origin text not null default 'admin',
  add column if not exists operational_kind text,
  add column if not exists created_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists due_on date,
  add column if not exists assessed_on date;

alter table public.exam_definitions
  drop constraint if exists exam_definitions_origin_check;

alter table public.exam_definitions
  add constraint exam_definitions_origin_check
  check (origin in ('admin', 'teacher'));

alter table public.exam_definitions
  drop constraint if exists exam_definitions_operational_kind_check;

alter table public.exam_definitions
  add constraint exam_definitions_operational_kind_check
  check (
    operational_kind is null
    or operational_kind in (
      'class_test',
      'project',
      'practical',
      'assignment',
      'oral',
      'other'
    )
  );

comment on column public.exam_definitions.origin is
  'admin = school-scheduled/config; teacher = teacher-created assessment.';

comment on column public.exam_definitions.operational_kind is
  'Teacher/ops kind for class tests, projects, practicals, assignments, oral.';

-- ---------------------------------------------------------------------------
-- 2. Schedules — optional section scope
-- ---------------------------------------------------------------------------

alter table public.exam_subject_schedules
  add column if not exists section_id uuid references public.sections (id) on delete set null;

create index if not exists exam_subject_schedules_section_idx
  on public.exam_subject_schedules (section_id)
  where section_id is not null and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Seed ASSIGNMENT exam type for schools missing it
-- ---------------------------------------------------------------------------

insert into public.assessment_exam_types (
  school_id,
  code,
  name,
  description,
  default_weightage_percent,
  default_max_marks,
  default_pass_marks,
  display_order
)
select
  s.id,
  'ASSIGN',
  'Assignment',
  'Homework / take-home assignment',
  5,
  20,
  8,
  90
from public.schools s
where not exists (
  select 1
  from public.assessment_exam_types t
  where t.school_id = s.id
    and t.code = 'ASSIGN'
    and t.archived_at is null
);

-- ---------------------------------------------------------------------------
-- 4. Mark sessions (bulk entry container)
-- ---------------------------------------------------------------------------

create table public.assessment_mark_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  exam_definition_id uuid not null references public.exam_definitions (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  class_id uuid references public.classes (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  exam_subject_schedule_id uuid
    references public.exam_subject_schedules (id) on delete set null,
  assessment_component_id uuid
    references public.assessment_components (id) on delete set null,
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'published', 'locked')),
  entered_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assessment_mark_sessions is
  'E11 marks-entry batch. Teachers edit until Admin/HOD locks. Publish opens parent/student visibility.';

create unique index assessment_mark_sessions_unique_idx
  on public.assessment_mark_sessions (
    exam_definition_id,
    subject_id,
    coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(assessment_component_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index assessment_mark_sessions_school_workflow_idx
  on public.assessment_mark_sessions (school_id, workflow_status);

create index assessment_mark_sessions_exam_idx
  on public.assessment_mark_sessions (exam_definition_id, subject_id);

alter table public.assessment_mark_sessions enable row level security;
revoke all on public.assessment_mark_sessions from anon;
grant select, insert, update on public.assessment_mark_sessions to authenticated;

create policy assessment_mark_sessions_own on public.assessment_mark_sessions
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Enrich exam_results (append / correct)
-- ---------------------------------------------------------------------------

alter table public.exam_results
  add column if not exists mark_session_id uuid
    references public.assessment_mark_sessions (id) on delete set null,
  add column if not exists student_academic_year_id uuid
    references public.student_academic_years (id) on delete set null,
  add column if not exists section_id uuid references public.sections (id) on delete set null,
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists exam_subject_schedule_id uuid
    references public.exam_subject_schedules (id) on delete set null,
  add column if not exists assessment_component_id uuid
    references public.assessment_components (id) on delete set null,
  add column if not exists grading_scale_version_id uuid
    references public.grading_scale_versions (id) on delete set null,
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists teacher_remark text,
  add column if not exists entered_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists visible_to_guardians boolean not null default false,
  add column if not exists visible_to_students boolean not null default false,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists correction_of_id uuid
    references public.exam_results (id) on delete set null,
  add column if not exists is_correction boolean not null default false,
  add column if not exists superseded_at timestamptz,
  add column if not exists correction_reason text;

alter table public.exam_results
  drop constraint if exists exam_results_workflow_status_check;

alter table public.exam_results
  add constraint exam_results_workflow_status_check
  check (workflow_status in ('draft', 'published', 'locked'));

comment on table public.exam_results is
  'E11 append-only marks. Corrections supersede prior rows; never silent rewrite of meaning.';

-- Replace uniqueness so corrections can coexist (current row only)
drop index if exists public.exam_results_unique_idx;

create unique index exam_results_current_unique_idx
  on public.exam_results (
    student_profile_id,
    exam_definition_id,
    subject_id,
    coalesce(assessment_component_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where superseded_at is null;

create index if not exists exam_results_session_idx
  on public.exam_results (mark_session_id)
  where mark_session_id is not null;

create index if not exists exam_results_workflow_idx
  on public.exam_results (school_id, workflow_status);

create index if not exists exam_results_visible_idx
  on public.exam_results (student_profile_id, academic_year_id)
  where visible_to_guardians or visible_to_students;

-- ---------------------------------------------------------------------------
-- 6. Assessment results audit log
-- ---------------------------------------------------------------------------

create table public.assessment_results_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  mark_session_id uuid
    references public.assessment_mark_sessions (id) on delete set null,
  exam_result_id uuid references public.exam_results (id) on delete set null,
  exam_definition_id uuid references public.exam_definitions (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

comment on table public.assessment_results_audit_log is
  'E11 append-only audit for marks entry, publish, lock, and corrections.';

create index assessment_results_audit_school_idx
  on public.assessment_results_audit_log (school_id, created_at desc);

create index assessment_results_audit_session_idx
  on public.assessment_results_audit_log (mark_session_id)
  where mark_session_id is not null;

alter table public.assessment_results_audit_log enable row level security;
revoke all on public.assessment_results_audit_log from anon;
grant select, insert on public.assessment_results_audit_log to authenticated;

create policy assessment_results_audit_own on public.assessment_results_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy assessment_results_audit_insert on public.assessment_results_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
