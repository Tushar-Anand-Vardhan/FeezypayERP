-- Phase 2: Homework & Assignment Engine
-- Enrich SCHEMA-READY homework_assignments; add submissions (student portal FUTURE),
-- marks/feedback, parent visibility, AI evaluation stubs.

-- ---------------------------------------------------------------------------
-- 1. Enrich homework_assignments
-- ---------------------------------------------------------------------------

alter table public.homework_assignments
  add column if not exists assignment_kind text not null default 'homework',
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists instructions text,
  add column if not exists max_marks numeric(8, 2),
  add column if not exists allow_late boolean not null default true,
  add column if not exists late_until date,
  add column if not exists due_at timestamptz,
  add column if not exists attachment_media_ids uuid[] not null default '{}'::uuid[],
  add column if not exists parent_visible boolean not null default true,
  add column if not exists visible_to_students boolean not null default true,
  add column if not exists published_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists ai_evaluation_enabled boolean not null default false,
  add column if not exists ai_evaluation_status text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'homework_assignments_assignment_kind_check'
  ) then
    alter table public.homework_assignments
      add constraint homework_assignments_assignment_kind_check
      check (assignment_kind in ('homework', 'assignment', 'project'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'homework_assignments_ai_evaluation_status_check'
  ) then
    alter table public.homework_assignments
      add constraint homework_assignments_ai_evaluation_status_check
      check (
        ai_evaluation_status in ('none', 'pending', 'completed', 'failed', 'disabled')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'homework_assignments_late_until_check'
  ) then
    alter table public.homework_assignments
      add constraint homework_assignments_late_until_check
      check (late_until is null or due_on is null or late_until >= due_on);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'homework_assignments_max_marks_check'
  ) then
    alter table public.homework_assignments
      add constraint homework_assignments_max_marks_check
      check (max_marks is null or max_marks >= 0);
  end if;
end $$;

-- Expand status vocabulary (keep draft/assigned/closed; add published alias via assigned)
comment on table public.homework_assignments is
  'Homework & Assignment Engine: homework / assignment / project briefs. Submissions & marks in homework_submissions.';

comment on column public.homework_assignments.assignment_kind is
  'homework | assignment | project';

comment on column public.homework_assignments.attachment_media_ids is
  'E27 media uuid refs for teacher brief attachments — no bytes here.';

comment on column public.homework_assignments.ai_evaluation_enabled is
  'Future E23 AI evaluation flag; runtime NOT BUILT.';

create index if not exists homework_assignments_kind_idx
  on public.homework_assignments (school_id, assignment_kind, academic_year_id)
  where archived_at is null;

create index if not exists homework_assignments_class_idx
  on public.homework_assignments (class_id, due_on)
  where archived_at is null and class_id is not null;

create index if not exists homework_assignments_parent_vis_idx
  on public.homework_assignments (school_id, academic_year_id, due_on)
  where archived_at is null and parent_visible = true and status = 'assigned';

-- ---------------------------------------------------------------------------
-- 2. Submissions (teacher-recorded now; student self-submit FUTURE)
-- ---------------------------------------------------------------------------

create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  homework_id uuid not null
    references public.homework_assignments (id) on delete restrict,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete restrict,
  status text not null default 'not_submitted'
    check (
      status in (
        'not_submitted',
        'draft',
        'submitted',
        'late',
        'returned',
        'graded',
        'excused'
      )
    ),
  submitted_at timestamptz,
  is_late boolean not null default false,
  attachment_media_ids uuid[] not null default '{}'::uuid[],
  student_notes text,
  -- Teacher-recorded until student portal (FUTURE self-submit)
  recorded_by_teacher boolean not null default true,
  marks_awarded numeric(8, 2),
  teacher_feedback text,
  graded_at timestamptz,
  graded_by uuid references auth.users (id) on delete set null,
  graded_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  -- Future AI evaluation (E23) — schema only
  ai_evaluation_status text not null default 'none'
    check (
      ai_evaluation_status in ('none', 'pending', 'completed', 'failed', 'disabled')
    ),
  ai_evaluation_json jsonb,
  ai_evaluated_at timestamptz,
  returned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (marks_awarded is null or marks_awarded >= 0)
);

comment on table public.homework_submissions is
  'Per-student homework submission + marks/feedback. Student self-submit FUTURE; teacher may record now.';

comment on column public.homework_submissions.recorded_by_teacher is
  'true when teacher logged receipt/marks without student portal upload.';

comment on column public.homework_submissions.ai_evaluation_json is
  'Future E23 evaluation payload; never authoritative for marks.';

create unique index homework_submissions_unique_active_idx
  on public.homework_submissions (homework_id, student_profile_id)
  where archived_at is null;

create index homework_submissions_student_idx
  on public.homework_submissions (student_profile_id, submitted_at desc)
  where archived_at is null;

create index homework_submissions_homework_status_idx
  on public.homework_submissions (homework_id, status)
  where archived_at is null;

alter table public.homework_submissions enable row level security;
revoke all on public.homework_submissions from anon;
grant select, insert, update on public.homework_submissions to authenticated;

create policy homework_submissions_own on public.homework_submissions
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Audit
-- ---------------------------------------------------------------------------

create table public.homework_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  homework_id uuid references public.homework_assignments (id) on delete set null,
  submission_id uuid references public.homework_submissions (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index homework_audit_school_idx
  on public.homework_audit_log (school_id, created_at desc);

create index homework_audit_homework_idx
  on public.homework_audit_log (homework_id, created_at desc)
  where homework_id is not null;

alter table public.homework_audit_log enable row level security;
revoke all on public.homework_audit_log from anon;
grant select, insert on public.homework_audit_log to authenticated;

create policy homework_audit_select on public.homework_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy homework_audit_insert on public.homework_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
