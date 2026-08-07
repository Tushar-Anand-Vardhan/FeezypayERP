-- Phase 3: Curriculum Engine (E30)
-- Year/board/grade/subject packs, hierarchical structure, immutable publish versions,
-- teacher progress + notes. AuthZ keys seeded for curriculum.*.

-- ---------------------------------------------------------------------------
-- 1. Root packs
-- ---------------------------------------------------------------------------

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  board_id uuid references public.report_card_boards (id) on delete set null,
  board_code text,
  code text not null,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  suggested_total_hours numeric check (suggested_total_hours is null or suggested_total_hours >= 0),
  cloned_from_curriculum_id uuid references public.curricula (id) on delete set null,
  cloned_from_version_id uuid,
  cloned_at timestamptz,
  cloned_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.curricula is
  'E30 Curriculum Engine — year×class×subject pack. Grade = classes row.';

create unique index curricula_active_year_subject_class_unique_idx
  on public.curricula (school_id, academic_year_id, subject_id, class_id)
  where archived_at is null;

create unique index curricula_school_active_code_unique_idx
  on public.curricula (school_id, lower(code))
  where archived_at is null;

create index curricula_school_year_idx
  on public.curricula (school_id, academic_year_id)
  where archived_at is null;

alter table public.curricula enable row level security;
revoke all on public.curricula from anon;
grant select, insert, update on public.curricula to authenticated;

create policy curricula_own on public.curricula
  for all to authenticated
  using (school_id in (select public.membership_schools(auth.uid())))
  with check (school_id in (select public.membership_schools(auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. Versions (immutable snapshots)
-- ---------------------------------------------------------------------------

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete restrict,
  version integer not null check (version >= 1),
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text,
  published_at timestamptz,
  is_immutable boolean not null default false,
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (curriculum_id, version)
);

comment on table public.curriculum_versions is
  'E30 — immutable published curriculum snapshots (strategy V). No DELETE.';

create index curriculum_versions_current_idx
  on public.curriculum_versions (curriculum_id)
  where is_current = true;

alter table public.curricula
  add constraint curricula_cloned_from_version_fk
  foreign key (cloned_from_version_id)
  references public.curriculum_versions (id) on delete set null;

alter table public.curriculum_versions enable row level security;
revoke all on public.curriculum_versions from anon;
grant select, insert, update on public.curriculum_versions to authenticated;

create policy curriculum_versions_own on public.curriculum_versions
  for all to authenticated
  using (
    curriculum_id in (
      select id from public.curricula
      where school_id in (select public.membership_schools(auth.uid()))
    )
  )
  with check (
    curriculum_id in (
      select id from public.curricula
      where school_id in (select public.membership_schools(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Structure
-- ---------------------------------------------------------------------------

create table public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  code text,
  title text not null,
  description text,
  suggested_hours numeric check (suggested_hours is null or suggested_hours >= 0),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_units_curriculum_idx
  on public.curriculum_units (curriculum_id)
  where archived_at is null;

create table public.curriculum_chapters (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  code text,
  title text not null,
  description text,
  textbook_ref text,
  suggested_hours numeric check (suggested_hours is null or suggested_hours >= 0),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_chapters_unit_idx
  on public.curriculum_chapters (unit_id)
  where archived_at is null;

create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  chapter_id uuid not null references public.curriculum_chapters (id) on delete cascade,
  code text,
  title text not null,
  description text,
  suggested_hours numeric check (suggested_hours is null or suggested_hours >= 0),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_topics_chapter_idx
  on public.curriculum_topics (chapter_id)
  where archived_at is null;

create table public.curriculum_subtopics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  topic_id uuid not null references public.curriculum_topics (id) on delete cascade,
  code text,
  title text not null,
  description text,
  suggested_hours numeric check (suggested_hours is null or suggested_hours >= 0),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_subtopics_topic_idx
  on public.curriculum_subtopics (topic_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 4. Outcomes / competencies
-- ---------------------------------------------------------------------------

create table public.curriculum_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  unit_id uuid references public.curriculum_units (id) on delete set null,
  chapter_id uuid references public.curriculum_chapters (id) on delete set null,
  topic_id uuid references public.curriculum_topics (id) on delete set null,
  subtopic_id uuid references public.curriculum_subtopics (id) on delete set null,
  code text,
  statement text not null,
  bloom_level text,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_lo_curriculum_idx
  on public.curriculum_learning_outcomes (curriculum_id)
  where archived_at is null;

create table public.curriculum_competencies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  code text,
  name text not null,
  framework text,
  description text,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_competencies_curriculum_idx
  on public.curriculum_competencies (curriculum_id)
  where archived_at is null;

create table public.curriculum_outcome_competencies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  learning_outcome_id uuid not null references public.curriculum_learning_outcomes (id) on delete cascade,
  competency_id uuid not null references public.curriculum_competencies (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index curriculum_outcome_competencies_active_unique_idx
  on public.curriculum_outcome_competencies (learning_outcome_id, competency_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 5. Resources / notes
-- ---------------------------------------------------------------------------

create table public.curriculum_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  unit_id uuid references public.curriculum_units (id) on delete set null,
  chapter_id uuid references public.curriculum_chapters (id) on delete set null,
  topic_id uuid references public.curriculum_topics (id) on delete set null,
  subtopic_id uuid references public.curriculum_subtopics (id) on delete set null,
  resource_kind text not null default 'link'
    check (resource_kind in ('link', 'file', 'note', 'other')),
  title text not null,
  url text,
  media_id uuid,
  visibility text not null default 'shared'
    check (visibility in ('shared', 'staff')),
  display_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curriculum_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  unit_id uuid references public.curriculum_units (id) on delete set null,
  chapter_id uuid references public.curriculum_chapters (id) on delete set null,
  topic_id uuid references public.curriculum_topics (id) on delete set null,
  subtopic_id uuid references public.curriculum_subtopics (id) on delete set null,
  visibility text not null default 'private'
    check (visibility in ('private', 'shared')),
  author_employment_id uuid not null references public.teacher_employments (id) on delete cascade,
  body text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index curriculum_notes_author_idx
  on public.curriculum_notes (author_employment_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 6. Progress (ops)
-- ---------------------------------------------------------------------------

create table public.curriculum_topic_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  curriculum_version_id uuid not null references public.curriculum_versions (id) on delete restrict,
  section_id uuid not null references public.sections (id) on delete cascade,
  employment_id uuid not null references public.teacher_employments (id) on delete cascade,
  node_type text not null
    check (node_type in ('topic', 'subtopic', 'chapter', 'unit')),
  node_id uuid not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  completion_pct numeric check (completion_pct is null or (completion_pct >= 0 and completion_pct <= 100)),
  completed_at timestamptz,
  teaching_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index curriculum_topic_progress_active_unique_idx
  on public.curriculum_topic_progress (
    section_id, curriculum_version_id, node_type, node_id, employment_id
  )
  where archived_at is null;

create index curriculum_topic_progress_version_idx
  on public.curriculum_topic_progress (curriculum_version_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 7. Local audit
-- ---------------------------------------------------------------------------

create table public.curriculum_audit_log (
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

create index curriculum_audit_log_school_idx
  on public.curriculum_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. RLS helpers for child tables (school_id column)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'curriculum_units',
    'curriculum_chapters',
    'curriculum_topics',
    'curriculum_subtopics',
    'curriculum_learning_outcomes',
    'curriculum_competencies',
    'curriculum_outcome_competencies',
    'curriculum_resources',
    'curriculum_notes',
    'curriculum_topic_progress',
    'curriculum_audit_log'
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
-- 9. AuthZ permissions + role grants
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  ('curriculum.pack.read', 'curriculum', 'Read curriculum packs and published versions'),
  ('curriculum.pack.edit', 'curriculum', 'Create/update curriculum pack metadata'),
  ('curriculum.pack.publish', 'curriculum', 'Publish curriculum pack to immutable version'),
  ('curriculum.pack.archive', 'curriculum', 'Archive or retire curriculum packs'),
  ('curriculum.pack.clone', 'curriculum', 'Clone curriculum pack to another year/class'),
  ('curriculum.structure.edit', 'curriculum', 'Edit units/chapters/topics/subtopics'),
  ('curriculum.outcome.edit', 'curriculum', 'Edit learning outcomes and competencies'),
  ('curriculum.resource.edit', 'curriculum', 'Edit shared curriculum resources'),
  ('curriculum.progress.read', 'curriculum', 'Read curriculum teaching progress'),
  ('curriculum.progress.record', 'curriculum', 'Record own curriculum progress and private notes')
on conflict (key) do nothing;

-- Full curriculum.* for admin leadership
insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('curriculum.pack.read'),
    ('curriculum.pack.edit'),
    ('curriculum.pack.publish'),
    ('curriculum.pack.archive'),
    ('curriculum.pack.clone'),
    ('curriculum.structure.edit'),
    ('curriculum.outcome.edit'),
    ('curriculum.resource.edit'),
    ('curriculum.progress.read'),
    ('curriculum.progress.record')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

-- Teachers: read + progress only
insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('curriculum.pack.read'),
    ('curriculum.progress.read'),
    ('curriculum.progress.record')
) as p(key)
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;
