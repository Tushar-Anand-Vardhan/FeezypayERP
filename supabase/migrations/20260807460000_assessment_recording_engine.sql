-- Phase 3: Assessment Recording Engine (E32)
-- Teacher evidence under E31 framework categories; append-only marks; lock.

-- ---------------------------------------------------------------------------
-- 1. Assessment records
-- ---------------------------------------------------------------------------

create table public.assessment_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  assessment_framework_id uuid not null
    references public.assessment_frameworks (id) on delete restrict,
  assessment_framework_version_id uuid not null
    references public.assessment_framework_versions (id) on delete restrict,
  framework_category_id uuid not null
    references public.assessment_framework_categories (id) on delete restrict,
  title text not null,
  conducted_on date not null,
  description text,
  class_id uuid not null references public.classes (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  max_marks numeric(8, 2) not null check (max_marks > 0),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'locked')),
  author_employment_id uuid not null
    references public.teacher_employments (id) on delete restrict,
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assessment_records is
  'E32 — teacher evidence under an E31 framework category. Teachers do not design structure.';

create index assessment_records_category_idx
  on public.assessment_records (framework_category_id)
  where archived_at is null;

create index assessment_records_section_idx
  on public.assessment_records (school_id, section_id, conducted_on desc)
  where archived_at is null;

create index assessment_records_author_idx
  on public.assessment_records (author_employment_id)
  where archived_at is null;

alter table public.assessment_records enable row level security;
revoke all on public.assessment_records from anon;
grant select, insert, update on public.assessment_records to authenticated;

create policy assessment_records_own on public.assessment_records
  for all to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. Marks (append-only)
-- ---------------------------------------------------------------------------

create table public.assessment_record_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  record_id uuid not null references public.assessment_records (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete restrict,
  marks_obtained numeric(8, 2),
  is_absent boolean not null default false,
  remarks text,
  is_current boolean not null default true,
  supersedes_mark_id uuid references public.assessment_record_marks (id) on delete set null,
  superseded_at timestamptz,
  entered_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    is_absent = true
    or marks_obtained is null
    or marks_obtained >= 0
  )
);

comment on table public.assessment_record_marks is
  'E32 append-only marks. Edits insert new is_current row; never overwrite.';

create unique index assessment_record_marks_current_unique_idx
  on public.assessment_record_marks (record_id, student_profile_id)
  where is_current = true and superseded_at is null;

create index assessment_record_marks_record_idx
  on public.assessment_record_marks (record_id)
  where is_current = true;

-- ---------------------------------------------------------------------------
-- 3. Coverage + attachments
-- ---------------------------------------------------------------------------

create table public.assessment_record_topics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  record_id uuid not null references public.assessment_records (id) on delete cascade,
  node_type text not null check (node_type in ('topic', 'subtopic', 'chapter', 'unit')),
  node_id uuid not null,
  curriculum_version_id uuid references public.curriculum_versions (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index assessment_record_topics_active_uidx
  on public.assessment_record_topics (record_id, node_type, node_id)
  where archived_at is null;

create table public.assessment_record_outcomes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  record_id uuid not null references public.assessment_records (id) on delete cascade,
  learning_outcome_id uuid not null
    references public.curriculum_learning_outcomes (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index assessment_record_outcomes_active_uidx
  on public.assessment_record_outcomes (record_id, learning_outcome_id)
  where archived_at is null;

create table public.assessment_record_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  record_id uuid not null references public.assessment_records (id) on delete cascade,
  title text not null,
  resource_kind text not null default 'link'
    check (resource_kind in ('link', 'file', 'note', 'other')),
  url text,
  media_id uuid,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Audit
-- ---------------------------------------------------------------------------

create table public.assessment_recording_audit_log (
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

create index assessment_recording_audit_log_school_idx
  on public.assessment_recording_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. RLS children
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'assessment_record_marks',
    'assessment_record_topics',
    'assessment_record_outcomes',
    'assessment_record_attachments',
    'assessment_recording_audit_log'
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
-- 6. AuthZ
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  ('assessment_recording.read', 'assessment_recording', 'Read assessment records and marks'),
  ('assessment_recording.create', 'assessment_recording', 'Create assessment records under framework categories'),
  ('assessment_recording.edit', 'assessment_recording', 'Edit unlocked assessment record metadata'),
  ('assessment_recording.enter_marks', 'assessment_recording', 'Enter or supersede student marks until lock'),
  ('assessment_recording.lock', 'assessment_recording', 'Lock assessment records (HOD/Admin)'),
  ('assessment_recording.unlock', 'assessment_recording', 'Unlock assessment records (Admin)')
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('assessment_recording.read'),
    ('assessment_recording.create'),
    ('assessment_recording.edit'),
    ('assessment_recording.enter_marks'),
    ('assessment_recording.lock'),
    ('assessment_recording.unlock')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('assessment_recording.read'),
    ('assessment_recording.create'),
    ('assessment_recording.edit'),
    ('assessment_recording.enter_marks')
) as p(key)
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;
