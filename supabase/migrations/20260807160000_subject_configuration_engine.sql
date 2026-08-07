-- Phase 1: Subject Configuration Engine (E07 subject surface)
-- Rich subject master, groups, dependencies. Archive-only; FKs stay RESTRICT.

-- ---------------------------------------------------------------------------
-- 1. Subject groups
-- ---------------------------------------------------------------------------

create table public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  description text,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subject_groups is
  'E07 subject grouping (e.g. Sciences, Languages). Subjects reference optionally.';

create unique index subject_groups_school_active_name_unique_idx
  on public.subject_groups (school_id, lower(name))
  where archived_at is null;

create unique index subject_groups_school_active_code_unique_idx
  on public.subject_groups (school_id, lower(code))
  where archived_at is null and code is not null;

create index subject_groups_school_active_idx
  on public.subject_groups (school_id, display_order)
  where archived_at is null;

alter table public.subject_groups enable row level security;
revoke all on public.subject_groups from anon;
grant select, insert, update on public.subject_groups to authenticated;

create policy subject_groups_own
  on public.subject_groups
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Enrich subjects (master)
-- ---------------------------------------------------------------------------

alter table public.subjects
  add column if not exists description text,
  add column if not exists subject_group_id uuid references public.subject_groups (id) on delete set null,
  add column if not exists category text not null default 'scholastic',
  add column if not exists is_language boolean not null default false,
  add column if not exists language_code text,
  add column if not exists is_elective boolean not null default false,
  add column if not exists board_code text,
  add column if not exists board_subject_name text,
  add column if not exists credits numeric(4, 1),
  add column if not exists weekly_periods smallint,
  add column if not exists requires_lab boolean not null default false,
  add column if not exists display_order integer not null default 0,
  add column if not exists assessment_rules jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists textbook_isbn text,
  add column if not exists textbook_title text,
  add column if not exists ai_lesson_plan_enabled boolean not null default false,
  add column if not exists chapter_map jsonb not null default '[]'::jsonb;

-- Backfill category from legacy type
update public.subjects
set category = case
  when type = 'co_scholastic' then 'co_scholastic'
  else 'scholastic'
end
where category is null or category = 'scholastic';

alter table public.subjects
  drop constraint if exists subjects_category_chk;

alter table public.subjects
  add constraint subjects_category_chk
  check (category in ('scholastic', 'co_scholastic', 'language', 'elective'));

alter table public.subjects
  drop constraint if exists subjects_credits_chk;

alter table public.subjects
  add constraint subjects_credits_chk
  check (credits is null or (credits >= 0 and credits <= 99.9));

alter table public.subjects
  drop constraint if exists subjects_weekly_periods_chk;

alter table public.subjects
  add constraint subjects_weekly_periods_chk
  check (weekly_periods is null or (weekly_periods >= 0 and weekly_periods <= 40));

comment on column public.subjects.category is
  'scholastic | co_scholastic | language | elective. Legacy type column kept for onboarding compat.';
comment on column public.subjects.assessment_rules is
  'JSON: grading_type, max_marks, pass_marks, has_practical, practical_weightage, internal_assessment, …';
comment on column public.subjects.textbook_isbn is
  'Future textbook integration stub.';
comment on column public.subjects.chapter_map is
  'Future chapter mapping stub: [{ number, title, … }].';
comment on column public.subjects.ai_lesson_plan_enabled is
  'Future AI lesson planning flag.';

create index subjects_group_idx
  on public.subjects (subject_group_id)
  where subject_group_id is not null and archived_at is null;

create index subjects_school_display_order_idx
  on public.subjects (school_id, display_order)
  where archived_at is null;

create index subjects_language_idx
  on public.subjects (school_id)
  where is_language = true and archived_at is null;

create index subjects_elective_idx
  on public.subjects (school_id)
  where is_elective = true and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Subject dependencies (prerequisites / corequisites)
-- ---------------------------------------------------------------------------

create table public.subject_dependencies (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  depends_on_subject_id uuid not null references public.subjects (id) on delete restrict,
  dependency_type text not null default 'prerequisite',
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subject_id <> depends_on_subject_id),
  check (dependency_type in ('prerequisite', 'corequisite', 'recommended'))
);

comment on table public.subject_dependencies is
  'E07 subject dependency graph. Archive to unlink; never hard-delete subjects with deps.';

create unique index subject_dependencies_active_unique_idx
  on public.subject_dependencies (subject_id, depends_on_subject_id)
  where archived_at is null;

create index subject_dependencies_depends_on_idx
  on public.subject_dependencies (depends_on_subject_id)
  where archived_at is null;

alter table public.subject_dependencies enable row level security;
revoke all on public.subject_dependencies from anon;
grant select, insert, update on public.subject_dependencies to authenticated;

create policy subject_dependencies_own
  on public.subject_dependencies
  for all to authenticated
  using (
    subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and depends_on_subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Future textbook rows (schema-ready)
-- ---------------------------------------------------------------------------

create table public.subject_textbooks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  title text not null,
  isbn text,
  publisher text,
  edition text,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  is_primary boolean not null default false,
  media_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subject_textbooks is
  'FUTURE textbook catalog per subject. App writes deferred; subject.textbook_* are quick stubs.';

alter table public.subject_textbooks enable row level security;
revoke all on public.subject_textbooks from anon;
grant select, insert, update on public.subject_textbooks to authenticated;

create policy subject_textbooks_own
  on public.subject_textbooks
  for all to authenticated
  using (
    subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
