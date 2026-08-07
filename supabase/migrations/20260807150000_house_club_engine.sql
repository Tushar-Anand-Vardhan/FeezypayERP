-- Phase 1: House & Club Engine (E07 surface)
-- Catalog enrichments + memberships/roles. Future: points, club events, competitions.

-- ---------------------------------------------------------------------------
-- 1. Enrich houses
-- ---------------------------------------------------------------------------

alter table public.houses
  add column if not exists description text,
  add column if not exists colour text,
  add column if not exists secondary_colour text,
  add column if not exists logo_path text,
  add column if not exists academic_year_id uuid references public.academic_years (id) on delete set null,
  add column if not exists teacher_in_charge_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists points_tracking_enabled boolean not null default false,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

comment on table public.houses is
  'E07 house catalog. Memberships are relationships; students stay on Person/Admission.';
comment on column public.houses.colour is
  'Primary house colour (hex preferred, e.g. #1A73E8).';
comment on column public.houses.logo_path is
  'Storage path / E27 pointer for house crest; bytes not owned here.';
comment on column public.houses.academic_year_id is
  'Null = school-wide house; set = year-scoped house definition.';
comment on column public.houses.teacher_in_charge_employment_id is
  'Staff TIC relationship → teacher_employments (not Person row).';
comment on column public.houses.points_tracking_enabled is
  'Future house points ledger; unused in v1.';

-- Year-aware uniqueness (replace school-wide-only name unique)
drop index if exists public.houses_school_active_name_unique_idx;

create unique index houses_school_default_active_name_unique_idx
  on public.houses (school_id, lower(name))
  where archived_at is null and academic_year_id is null;

create unique index houses_school_year_active_name_unique_idx
  on public.houses (school_id, academic_year_id, lower(name))
  where archived_at is null and academic_year_id is not null;

create index houses_academic_year_idx
  on public.houses (academic_year_id)
  where academic_year_id is not null and archived_at is null;

create index houses_tic_idx
  on public.houses (teacher_in_charge_employment_id)
  where teacher_in_charge_employment_id is not null and archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Enrich clubs
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column if not exists code text,
  add column if not exists colour text,
  add column if not exists logo_path text,
  add column if not exists academic_year_id uuid references public.academic_years (id) on delete set null,
  add column if not exists teacher_in_charge_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists events_enabled boolean not null default false,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

comment on table public.clubs is
  'E07 club catalog. Memberships are relationships; students stay on Person.';
comment on column public.clubs.events_enabled is
  'Future club events / competitions hook; unused in v1.';
comment on column public.clubs.teacher_in_charge_employment_id is
  'Staff TIC → teacher_employments.';

drop index if exists public.clubs_school_active_name_unique_idx;

create unique index clubs_school_default_active_name_unique_idx
  on public.clubs (school_id, lower(name))
  where archived_at is null and academic_year_id is null;

create unique index clubs_school_year_active_name_unique_idx
  on public.clubs (school_id, academic_year_id, lower(name))
  where archived_at is null and academic_year_id is not null;

create unique index clubs_school_active_code_unique_idx
  on public.clubs (school_id, lower(code))
  where archived_at is null and code is not null;

create index clubs_academic_year_idx
  on public.clubs (academic_year_id)
  where academic_year_id is not null and archived_at is null;

create index clubs_tic_idx
  on public.clubs (teacher_in_charge_employment_id)
  where teacher_in_charge_employment_id is not null and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. House memberships (dated; roles include captains)
-- ---------------------------------------------------------------------------

create table public.house_memberships (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete restrict,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  role text not null default 'member',
  joined_on date not null default (current_date),
  left_on date,
  created_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('member', 'captain', 'vice_captain')),
  check (left_on is null or left_on >= joined_on)
);

comment on table public.house_memberships is
  'E07 house↔student relationships. Prefer over mutating Person. admission.house_id kept in sync for legacy.';

create unique index house_memberships_active_unique_idx
  on public.house_memberships (
    house_id,
    student_profile_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null;

create unique index house_memberships_one_active_captain_idx
  on public.house_memberships (
    house_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null and role = 'captain';

create unique index house_memberships_one_active_vice_captain_idx
  on public.house_memberships (
    house_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null and role = 'vice_captain';

create index house_memberships_student_idx
  on public.house_memberships (student_profile_id)
  where left_on is null;

alter table public.house_memberships enable row level security;
revoke all on public.house_memberships from anon;
grant select, insert, update on public.house_memberships to authenticated;

create policy house_memberships_own
  on public.house_memberships
  for all to authenticated
  using (
    house_id in (
      select id from public.houses
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    house_id in (
      select id from public.houses
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
    and student_profile_id in (
      select sa.student_profile_id
      from public.student_admissions sa
      where sa.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- Backfill from admission.house_id
insert into public.house_memberships (
  house_id,
  student_profile_id,
  role,
  joined_on,
  notes
)
select
  a.house_id,
  a.student_profile_id,
  'member',
  current_date,
  'Backfilled from student_admissions.house_id'
from public.student_admissions a
where a.house_id is not null
  and a.status = 'active'
  and not exists (
    select 1
    from public.house_memberships m
    where m.house_id = a.house_id
      and m.student_profile_id = a.student_profile_id
      and m.left_on is null
      and m.academic_year_id is null
  );

-- ---------------------------------------------------------------------------
-- 4. Enrich club_memberships with roles + year
-- ---------------------------------------------------------------------------

alter table public.club_memberships
  add column if not exists role text not null default 'member',
  add column if not exists academic_year_id uuid references public.academic_years (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.club_memberships
  drop constraint if exists club_memberships_role_chk;

alter table public.club_memberships
  add constraint club_memberships_role_chk
  check (role in ('member', 'captain', 'vice_captain'));

comment on column public.club_memberships.role is
  'member | captain | vice_captain';

-- Tighten uniqueness to include year; drop old unique
drop index if exists public.club_memberships_active_unique_idx;

create unique index club_memberships_active_unique_idx
  on public.club_memberships (
    club_id,
    student_profile_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null;

create unique index club_memberships_one_active_captain_idx
  on public.club_memberships (
    club_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null and role = 'captain';

create unique index club_memberships_one_active_vice_captain_idx
  on public.club_memberships (
    club_id,
    coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where left_on is null and role = 'vice_captain';

-- ---------------------------------------------------------------------------
-- 5. Future stub tables (schema-ready, empty contracts)
-- ---------------------------------------------------------------------------

create table public.house_point_ledger (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  points integer not null,
  reason text,
  awarded_on date not null default (current_date),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.house_point_ledger is
  'FUTURE house points. Schema-ready; app writes deferred.';

alter table public.house_point_ledger enable row level security;
revoke all on public.house_point_ledger from anon;
grant select, insert on public.house_point_ledger to authenticated;

create policy house_point_ledger_own
  on public.house_point_ledger
  for all to authenticated
  using (
    house_id in (
      select id from public.houses
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    house_id in (
      select id from public.houses
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

create table public.club_event_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  calendar_event_id uuid references public.calendar_events (id) on delete set null,
  title text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.club_event_links is
  'FUTURE club events / competitions / inter-house activity links to E17.';

alter table public.club_event_links enable row level security;
revoke all on public.club_event_links from anon;
grant select, insert, update on public.club_event_links to authenticated;

create policy club_event_links_own
  on public.club_event_links
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
  );
