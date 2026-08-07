-- Phase 1: Configuration Engine (E07)
-- Archive/restore catalogs, grading scales, club memberships, harden subject FKs.
-- No hard-delete path for authenticated users on catalog tables.

-- ---------------------------------------------------------------------------
-- 1. Archive columns on existing catalogs
-- ---------------------------------------------------------------------------

alter table public.subjects
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.houses
  add column if not exists code text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.clubs
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.subjects.archived_at is
  'E07 soft-retire; null = active. Prefer archive over delete.';
comment on column public.houses.archived_at is
  'E07 soft-retire; null = active.';
comment on column public.clubs.archived_at is
  'E07 soft-retire; null = active.';

-- Replace unique name indexes with active-only uniqueness
drop index if exists public.subjects_school_name_unique_idx;
create unique index subjects_school_active_name_unique_idx
  on public.subjects (school_id, lower(name))
  where archived_at is null;

-- Backfill subject codes where missing (stable slug from name)
update public.subjects
set code = upper(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where code is null or btrim(code) = '';

-- Ensure no empty codes remain
update public.subjects
set code = 'SUB-' || substr(replace(id::text, '-', ''), 1, 8)
where code is null or btrim(code) = '';

create unique index subjects_school_active_code_unique_idx
  on public.subjects (school_id, lower(code))
  where archived_at is null and code is not null;

drop index if exists public.houses_school_name_unique_idx;
create unique index houses_school_active_name_unique_idx
  on public.houses (school_id, lower(name))
  where archived_at is null;

create unique index houses_school_active_code_unique_idx
  on public.houses (school_id, lower(code))
  where archived_at is null and code is not null;

drop index if exists public.clubs_school_name_unique_idx;
create unique index clubs_school_active_name_unique_idx
  on public.clubs (school_id, lower(name))
  where archived_at is null;

create index if not exists subjects_school_active_idx
  on public.subjects (school_id)
  where archived_at is null;

create index if not exists houses_school_active_idx
  on public.houses (school_id)
  where archived_at is null;

create index if not exists clubs_school_active_idx
  on public.clubs (school_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Harden subject FKs: operational refs must not CASCADE-wipe history
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select con.conname, rel.relname as tbl
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and con.contype = 'f'
      and con.confrelid = 'public.subjects'::regclass
      and rel.relname in (
        'employment_subjects',
        'exam_subject_schedules',
        'teacher_subject_assignments',
        'class_subjects'
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.employment_subjects
  add constraint employment_subjects_subject_id_fkey
  foreign key (subject_id) references public.subjects (id) on delete restrict;

alter table public.exam_subject_schedules
  add constraint exam_subject_schedules_subject_id_fkey
  foreign key (subject_id) references public.subjects (id) on delete restrict;

alter table public.class_subjects
  add constraint class_subjects_subject_id_fkey
  foreign key (subject_id) references public.subjects (id) on delete restrict;

-- teacher_subject_assignments may still exist after identity cutover
do $$
begin
  if to_regclass('public.teacher_subject_assignments') is not null then
    alter table public.teacher_subject_assignments
      add constraint teacher_subject_assignments_subject_id_fkey
      foreign key (subject_id) references public.subjects (id) on delete restrict;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Revoke hard DELETE on catalog tables (archive via UPDATE only)
-- ---------------------------------------------------------------------------

revoke delete on public.subjects from authenticated;
revoke delete on public.houses from authenticated;
revoke delete on public.clubs from authenticated;

grant select, insert, update on public.subjects to authenticated;
grant select, insert, update on public.houses to authenticated;
grant select, insert, update on public.clubs to authenticated;

-- class_subjects remain replaceable (offer map)
grant select, insert, update, delete on public.class_subjects to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Grading scales (versioned definitions — E07)
-- ---------------------------------------------------------------------------

create table public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.grading_scales is
  'E07 grading scale definitions. Results pin grading_scale_versions.id (E11).';

create unique index grading_scales_school_active_code_unique_idx
  on public.grading_scales (school_id, lower(code))
  where archived_at is null;

create unique index grading_scales_school_active_name_unique_idx
  on public.grading_scales (school_id, lower(name))
  where archived_at is null;

create index grading_scales_school_active_idx
  on public.grading_scales (school_id)
  where archived_at is null;

create table public.grading_scale_versions (
  id uuid primary key default gen_random_uuid(),
  scale_id uuid not null references public.grading_scales (id) on delete restrict,
  version integer not null check (version >= 1),
  bands jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  is_immutable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (scale_id, version)
);

comment on table public.grading_scale_versions is
  'Immutable after publish (is_immutable). Assessment results reference version id.';

comment on column public.grading_scale_versions.bands is
  'JSON array of {min, max, grade, label?} band objects.';

create index grading_scale_versions_scale_idx
  on public.grading_scale_versions (scale_id);

alter table public.grading_scales enable row level security;
alter table public.grading_scale_versions enable row level security;

revoke all on public.grading_scales from anon;
revoke all on public.grading_scale_versions from anon;

grant select, insert, update on public.grading_scales to authenticated;
grant select, insert, update on public.grading_scale_versions to authenticated;
-- no delete grants

create policy grading_scales_own on public.grading_scales
  for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy grading_scale_versions_own on public.grading_scale_versions
  for all to authenticated
  using (
    scale_id in (
      select id from public.grading_scales
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    scale_id in (
      select id from public.grading_scales
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Club memberships (E07 catalog membership; dated)
-- ---------------------------------------------------------------------------

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  joined_on date not null default (current_date),
  left_on date,
  created_at timestamptz not null default now(),
  check (left_on is null or left_on >= joined_on)
);

comment on table public.club_memberships is
  'E07 club membership history. End membership via left_on; do not hard-delete.';

create unique index club_memberships_active_unique_idx
  on public.club_memberships (club_id, student_profile_id)
  where left_on is null;

create index club_memberships_student_idx
  on public.club_memberships (student_profile_id);

alter table public.club_memberships enable row level security;

revoke all on public.club_memberships from anon;
grant select, insert, update on public.club_memberships to authenticated;

create policy club_memberships_own on public.club_memberships
  for all to authenticated
  using (
    club_id in (
      select id from public.clubs
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    club_id in (
      select id from public.clubs
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and student_profile_id in (
      select sp.id
      from public.student_profiles sp
      join public.student_admissions sa on sa.student_profile_id = sp.id
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
