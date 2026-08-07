-- Phase 3: Student Observation Engine (E34)
-- Append-only structured observations across the academic year.
-- Nothing overwrites prior remarks; soft-archive only. AI summary stub for future.

-- ---------------------------------------------------------------------------
-- 1. Category catalog (system codes + school custom)
-- ---------------------------------------------------------------------------

create table public.student_observation_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  display_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_observation_categories is
  'E34 observation category catalog. System seeds + school custom categories.';

create unique index student_observation_categories_school_code_uidx
  on public.student_observation_categories (school_id, lower(code))
  where archived_at is null;

create index student_observation_categories_school_idx
  on public.student_observation_categories (school_id, display_order)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Observations (append-only narrative facts)
-- ---------------------------------------------------------------------------

create table public.student_observations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete restrict,
  academic_year_id uuid not null
    references public.academic_years (id) on delete restrict,
  term_id uuid references public.terms (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  category_id uuid not null
    references public.student_observation_categories (id) on delete restrict,
  category_code text not null,
  observed_on date not null,
  remark text not null,
  visibility text not null default 'staff'
    check (
      visibility in (
        'private',
        'staff',
        'parent_visible',
        'school'
      )
    ),
  visible_to_guardians boolean not null default false,
  visible_to_students boolean not null default false,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  student_academic_year_id uuid
    references public.student_academic_years (id) on delete set null,
  -- Corrections never overwrite: optional pointer to prior row
  supersedes_id uuid
    references public.student_observations (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.student_observations is
  'E34 append-only student observations. Remark body is immutable; soft-archive or supersede with a new row.';

comment on column public.student_observations.remark is
  'Immutable narrative. Never UPDATE this column after insert.';

comment on column public.student_observations.category_code is
  'Denormalized category code at write time for stable historical filters.';

create index student_observations_student_year_idx
  on public.student_observations (student_profile_id, academic_year_id, observed_on desc)
  where archived_at is null;

create index student_observations_school_filters_idx
  on public.student_observations (
    school_id, academic_year_id, category_code, observed_on desc
  )
  where archived_at is null;

create index student_observations_term_idx
  on public.student_observations (term_id, observed_on desc)
  where archived_at is null and term_id is not null;

create index student_observations_subject_idx
  on public.student_observations (subject_id, observed_on desc)
  where archived_at is null and subject_id is not null;

create index student_observations_teacher_idx
  on public.student_observations (recorded_by_employment_id, observed_on desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Future AI summaries (stub — no provider calls)
-- ---------------------------------------------------------------------------

create table public.student_observation_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete cascade,
  academic_year_id uuid not null
    references public.academic_years (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  category_code text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  prompt_fingerprint text,
  input_observation_ids uuid[] not null default '{}',
  summary_text text,
  model_id text,
  error_message text,
  requested_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_observation_ai_summaries is
  'E34 FUTURE AI summary jobs over observation sets. No provider calls in v1 — queue stub only.';

create index student_observation_ai_summaries_student_idx
  on public.student_observation_ai_summaries (
    student_profile_id, academic_year_id, created_at desc
  );

-- ---------------------------------------------------------------------------
-- 4. Audit
-- ---------------------------------------------------------------------------

create table public.student_observation_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  observation_id uuid
    references public.student_observations (id) on delete set null,
  category_id uuid
    references public.student_observation_categories (id) on delete set null,
  student_profile_id uuid
    references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index student_observation_audit_log_school_idx
  on public.student_observation_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'student_observation_categories',
    'student_observations',
    'student_observation_ai_summaries',
    'student_observation_audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    if t = 'student_observation_audit_log' then
      execute format(
        'grant select, insert on public.%I to authenticated',
        t
      );
      execute format(
        'create policy %I_select on public.%I for select to authenticated
           using (school_id in (select public.membership_schools(auth.uid())))',
        t, t
      );
      execute format(
        'create policy %I_insert on public.%I for insert to authenticated
           with check (school_id in (select public.membership_schools(auth.uid())))',
        t, t
      );
    else
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
    end if;
  end loop;
end $$;

-- Prevent hard DELETE on observations (append-only invariant at DB level)
revoke delete on public.student_observations from authenticated;

-- ---------------------------------------------------------------------------
-- 6. AuthZ
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  (
    'student_observation.read',
    'student_observation',
    'Read student observations (visibility-aware in app)'
  ),
  (
    'student_observation.record',
    'student_observation',
    'Record append-only student observations'
  ),
  (
    'student_observation.configure',
    'student_observation',
    'Configure custom observation categories'
  ),
  (
    'student_observation.archive',
    'student_observation',
    'Soft-archive observations (never overwrite)'
  )
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('student_observation.read'),
    ('student_observation.record'),
    ('student_observation.configure'),
    ('student_observation.archive')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('student_observation.read'),
    ('student_observation.record')
) as p(key)
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'student_observation.read'
from public.authz_roles r
where r.is_system = true
  and r.code in ('student', 'parent')
on conflict do nothing;
