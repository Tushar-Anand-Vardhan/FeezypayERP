-- Phase 1: Department Engine (E05 department surface)
-- Departments own relationships only — never Person/TeacherProfile rows.
-- Subjects catalog remains E07; eligibility remains employment_subjects;
-- timetable schedule remains E10.

-- ---------------------------------------------------------------------------
-- 1. Enrich departments
-- ---------------------------------------------------------------------------

alter table public.departments
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists parent_department_id uuid references public.departments (id) on delete set null,
  add column if not exists cost_center_code text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

comment on table public.departments is
  'E05 staff org unit. Owns memberships/assignments/resources — not teachers (E04 Person).';
comment on column public.departments.parent_department_id is
  'Future nested departments; nullable stub.';
comment on column public.departments.cost_center_code is
  'Future finance/cost-center link; unused in v1.';
comment on column public.departments.created_by is
  'Auth user who created the department record (edit ownership).';
comment on column public.departments.updated_by is
  'Auth user who last mutated the department row.';

-- Replace name unique with active-only unique + active code unique
drop index if exists public.departments_school_name_unique_idx;

create unique index departments_school_active_name_unique_idx
  on public.departments (school_id, lower(name))
  where archived_at is null;

create unique index departments_school_active_code_unique_idx
  on public.departments (school_id, lower(code))
  where archived_at is null and code is not null;

create index departments_school_active_idx
  on public.departments (school_id)
  where archived_at is null;

create index departments_parent_idx
  on public.departments (parent_department_id)
  where parent_department_id is not null;

revoke delete on public.departments from authenticated;
grant select, insert, update on public.departments to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Memberships (head / coordinator / member) — employment relationships
-- ---------------------------------------------------------------------------

create table public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  employment_id uuid not null references public.teacher_employments (id) on delete restrict,
  role text not null,
  joined_on date not null default (current_date),
  left_on date,
  created_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('head', 'coordinator', 'member')),
  check (left_on is null or left_on >= joined_on)
);

comment on table public.department_memberships is
  'E05 department↔employment relationships. Teachers stay on Person/TeacherProfile; end via left_on.';

create unique index department_memberships_active_unique_idx
  on public.department_memberships (department_id, employment_id)
  where left_on is null;

-- At most one active head per department
create unique index department_memberships_one_active_head_idx
  on public.department_memberships (department_id)
  where left_on is null and role = 'head';

create index department_memberships_employment_idx
  on public.department_memberships (employment_id)
  where left_on is null;

create index department_memberships_role_idx
  on public.department_memberships (department_id, role)
  where left_on is null;

alter table public.department_memberships enable row level security;
revoke all on public.department_memberships from anon;
grant select, insert, update on public.department_memberships to authenticated;

create policy department_memberships_own
  on public.department_memberships
  for all to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and employment_id in (
      select id from public.teacher_employments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- Backfill from employment.department_id / is_hod (at most one head per dept)
with ranked as (
  select
    e.department_id,
    e.id as employment_id,
    e.is_hod,
    coalesce(e.joined_on, current_date) as joined_on,
    row_number() over (
      partition by e.department_id
      order by e.is_hod desc, e.joined_on nulls last, e.created_at
    ) as rn
  from public.teacher_employments e
  where e.department_id is not null
    and e.status = 'active'
)
insert into public.department_memberships (
  department_id,
  employment_id,
  role,
  joined_on,
  notes
)
select
  r.department_id,
  r.employment_id,
  case when r.is_hod and r.rn = 1 then 'head' else 'member' end,
  r.joined_on,
  'Backfilled from teacher_employments'
from ranked r
where not exists (
  select 1
  from public.department_memberships m
  where m.department_id = r.department_id
    and m.employment_id = r.employment_id
    and m.left_on is null
);

-- ---------------------------------------------------------------------------
-- 3. Department subjects (org ownership of catalog subjects — not E07 rows)
-- ---------------------------------------------------------------------------

create table public.department_subjects (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  is_primary boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.department_subjects is
  'E05 which E07 subjects a department organizes. Subject catalog rows stay E07.';

create unique index department_subjects_active_unique_idx
  on public.department_subjects (department_id, subject_id)
  where archived_at is null;

create index department_subjects_subject_idx
  on public.department_subjects (subject_id)
  where archived_at is null;

alter table public.department_subjects enable row level security;
revoke all on public.department_subjects from anon;
grant select, insert, update on public.department_subjects to authenticated;

create policy department_subjects_own
  on public.department_subjects
  for all to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Teaching assignments (department-scoped employment↔subject relationships)
-- ---------------------------------------------------------------------------

create table public.department_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  employment_id uuid not null references public.teacher_employments (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  started_on date not null default (current_date),
  ended_on date,
  created_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

comment on table public.department_teaching_assignments is
  'E05 department teaching relationships. Not timetable slots (E10) and not eligibility-only (employment_subjects).';
comment on column public.department_teaching_assignments.academic_year_id is
  'Optional year scope; null = ongoing / unspecified.';

create unique index department_teaching_assignments_active_unique_idx
  on public.department_teaching_assignments (
    department_id,
    employment_id,
    subject_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where ended_on is null;

create index department_teaching_assignments_employment_idx
  on public.department_teaching_assignments (employment_id)
  where ended_on is null;

create index department_teaching_assignments_subject_idx
  on public.department_teaching_assignments (subject_id)
  where ended_on is null;

alter table public.department_teaching_assignments enable row level security;
revoke all on public.department_teaching_assignments from anon;
grant select, insert, update on public.department_teaching_assignments to authenticated;

create policy department_teaching_assignments_own
  on public.department_teaching_assignments
  for all to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and employment_id in (
      select id from public.teacher_employments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and subject_id in (
      select id from public.subjects
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Announcements
-- ---------------------------------------------------------------------------

create table public.department_announcements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  title text not null,
  body text not null default '',
  visibility text not null default 'department',
  status text not null default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  notify_on_publish boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility in ('department', 'staff', 'school')),
  check (status in ('draft', 'published', 'retracted'))
);

comment on table public.department_announcements is
  'E05 department-scoped announcements. Delivery via E18/E19 later (notify_on_publish stub).';

create index department_announcements_dept_created_idx
  on public.department_announcements (department_id, created_at desc)
  where archived_at is null;

create index department_announcements_status_idx
  on public.department_announcements (department_id, status)
  where archived_at is null;

alter table public.department_announcements enable row level security;
revoke all on public.department_announcements from anon;
grant select, insert, update on public.department_announcements to authenticated;

create policy department_announcements_own
  on public.department_announcements
  for all to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Resources
-- ---------------------------------------------------------------------------

create table public.department_resources (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  title text not null,
  description text,
  resource_type text not null default 'link',
  url text,
  media_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resource_type in ('link', 'file', 'note', 'other'))
);

comment on table public.department_resources is
  'E05 department resource links/notes. media_id reserved for E27.';
comment on column public.department_resources.media_id is
  'Future E27 media reference; no FK until media table ships broadly.';

create index department_resources_dept_idx
  on public.department_resources (department_id)
  where archived_at is null;

alter table public.department_resources enable row level security;
revoke all on public.department_resources from anon;
grant select, insert, update on public.department_resources to authenticated;

create policy department_resources_own
  on public.department_resources
  for all to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 7. History / edit tracking (append-only)
-- ---------------------------------------------------------------------------

create table public.department_history (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  action text not null,
  summary text,
  changes jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.department_history is
  'E05 append-only department audit trail (engine-local history until E28 Audit).';

create index department_history_dept_created_idx
  on public.department_history (department_id, created_at desc);

alter table public.department_history enable row level security;
revoke all on public.department_history from anon;
grant select, insert on public.department_history to authenticated;
-- no update/delete — append-only

create policy department_history_select
  on public.department_history
  for select to authenticated
  using (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create policy department_history_insert
  on public.department_history
  for insert to authenticated
  with check (
    department_id in (
      select id from public.departments
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
