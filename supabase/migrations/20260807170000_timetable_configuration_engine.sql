-- Phase 1: Timetable Configuration Engine (E10)
-- Grids, cycle days, availability, locking, room/substitute stubs.
-- Conflict detection enforced in app validation (indexes support lookups).

-- ---------------------------------------------------------------------------
-- 1. Rooms (future allocation — schema-ready)
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  capacity integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rooms is
  'E10 FUTURE room catalog for slot allocation. App allocation deferred.';

create unique index rooms_school_active_name_unique_idx
  on public.rooms (school_id, lower(name))
  where archived_at is null;

create unique index rooms_school_active_code_unique_idx
  on public.rooms (school_id, lower(code))
  where archived_at is null and code is not null;

alter table public.rooms enable row level security;
revoke all on public.rooms from anon;
grant select, insert, update on public.rooms to authenticated;

create policy rooms_own on public.rooms
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Timetable grids (primary + alternate)
-- ---------------------------------------------------------------------------

create table public.timetable_grids (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  grid_type text not null default 'primary',
  cycle_length smallint not null default 6,
  is_active boolean not null default false,
  effective_from date,
  effective_to date,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grid_type in ('primary', 'alternate', 'exam', 'special')),
  check (cycle_length between 1 and 14),
  check (
    effective_from is null
    or effective_to is null
    or effective_to >= effective_from
  )
);

comment on table public.timetable_grids is
  'E10 timetable version/grid. primary = default weekly; alternate/exam/special for overlays.';
comment on column public.timetable_grids.cycle_length is
  'Number of cycle days (6=Mon–Sat weekly; 5=Mon–Fri; >7 for rotating Day A/B…).';

create unique index timetable_grids_school_year_active_name_unique_idx
  on public.timetable_grids (school_id, academic_year_id, lower(name))
  where archived_at is null;

-- At most one active primary per year
create unique index timetable_grids_one_active_primary_idx
  on public.timetable_grids (academic_year_id)
  where archived_at is null and is_active = true and grid_type = 'primary';

create index timetable_grids_year_idx
  on public.timetable_grids (academic_year_id)
  where archived_at is null;

alter table public.timetable_grids enable row level security;
revoke all on public.timetable_grids from anon;
grant select, insert, update on public.timetable_grids to authenticated;

create policy timetable_grids_own on public.timetable_grids
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Cycle days
-- ---------------------------------------------------------------------------

create table public.timetable_cycle_days (
  id uuid primary key default gen_random_uuid(),
  grid_id uuid not null references public.timetable_grids (id) on delete cascade,
  day_index smallint not null,
  label text not null,
  maps_to_weekday smallint,
  created_at timestamptz not null default now(),
  check (day_index >= 1),
  check (
    maps_to_weekday is null
    or maps_to_weekday between 1 and 7
  ),
  unique (grid_id, day_index)
);

comment on table public.timetable_cycle_days is
  'E10 cycle day within a grid. maps_to_weekday set for weekly schedules; null for rotating cycles.';

create index timetable_cycle_days_grid_idx
  on public.timetable_cycle_days (grid_id, day_index);

alter table public.timetable_cycle_days enable row level security;
revoke all on public.timetable_cycle_days from anon;
grant select, insert, update, delete on public.timetable_cycle_days to authenticated;

create policy timetable_cycle_days_own on public.timetable_cycle_days
  for all to authenticated
  using (
    grid_id in (
      select id from public.timetable_grids
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    grid_id in (
      select id from public.timetable_grids
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Enrich period_definitions
-- ---------------------------------------------------------------------------

alter table public.period_definitions
  add column if not exists name text,
  add column if not exists is_break boolean not null default false,
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.period_definitions.is_locked is
  'When true, slots referencing this period cannot be mutated via engine APIs.';

create index period_definitions_year_active_idx
  on public.period_definitions (academic_year_id, period_number)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 5. Enrich timetable_slots
-- ---------------------------------------------------------------------------

alter table public.timetable_slots
  add column if not exists grid_id uuid references public.timetable_grids (id) on delete cascade,
  add column if not exists cycle_day_id uuid references public.timetable_cycle_days (id) on delete set null,
  add column if not exists room_id uuid references public.rooms (id) on delete set null,
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.timetable_slots.room_id is
  'FUTURE room allocation; nullable stub.';
comment on column public.timetable_slots.is_locked is
  'Slot-level lock; prevents edit/archive via engine until unlocked.';

-- Drop old unique; recreate grid-aware (legacy slots without grid keep section+day+period)
alter table public.timetable_slots
  drop constraint if exists timetable_slots_section_id_day_of_week_period_definition_id_key;

create unique index timetable_slots_legacy_unique_idx
  on public.timetable_slots (section_id, day_of_week, period_definition_id)
  where grid_id is null and archived_at is null;

create unique index timetable_slots_grid_unique_idx
  on public.timetable_slots (grid_id, section_id, day_of_week, period_definition_id)
  where grid_id is not null and archived_at is null;

create index timetable_slots_teacher_period_idx
  on public.timetable_slots (teacher_id, day_of_week, period_definition_id)
  where archived_at is null and teacher_id is not null;

create index timetable_slots_grid_idx
  on public.timetable_slots (grid_id)
  where archived_at is null and grid_id is not null;

create index timetable_slots_room_idx
  on public.timetable_slots (room_id, day_of_week, period_definition_id)
  where archived_at is null and room_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Teacher availability
-- ---------------------------------------------------------------------------

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  employment_id uuid not null references public.teacher_employments (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_definition_id uuid references public.period_definitions (id) on delete cascade,
  is_available boolean not null default true,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teacher_availability is
  'E10 teacher free/busy. is_available=false blocks scheduling. Null period = whole day.';

create unique index teacher_availability_active_unique_idx
  on public.teacher_availability (
    employment_id,
    day_of_week,
    coalesce(period_definition_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

create index teacher_availability_lookup_idx
  on public.teacher_availability (employment_id, day_of_week)
  where archived_at is null and is_available = false;

alter table public.teacher_availability enable row level security;
revoke all on public.teacher_availability from anon;
grant select, insert, update on public.teacher_availability to authenticated;

create policy teacher_availability_own on public.teacher_availability
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Section (class) availability
-- ---------------------------------------------------------------------------

create table public.section_availability (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_definition_id uuid references public.period_definitions (id) on delete cascade,
  is_available boolean not null default true,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.section_availability is
  'E10 section free/busy. is_available=false blocks scheduling into that cell.';

create unique index section_availability_active_unique_idx
  on public.section_availability (
    section_id,
    day_of_week,
    coalesce(period_definition_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

alter table public.section_availability enable row level security;
revoke all on public.section_availability from anon;
grant select, insert, update on public.section_availability to authenticated;

create policy section_availability_own on public.section_availability
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. Substitute teachers (future)
-- ---------------------------------------------------------------------------

create table public.timetable_substitutions (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.timetable_slots (id) on delete cascade,
  original_employment_id uuid references public.teacher_employments (id) on delete set null,
  substitute_employment_id uuid not null references public.teacher_employments (id) on delete restrict,
  for_date date not null,
  reason text,
  status text not null default 'scheduled',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status in ('scheduled', 'completed', 'cancelled'))
);

comment on table public.timetable_substitutions is
  'E10 FUTURE substitute overlay for a slot on a date. App workflow deferred.';

alter table public.timetable_substitutions enable row level security;
revoke all on public.timetable_substitutions from anon;
grant select, insert, update on public.timetable_substitutions to authenticated;

create policy timetable_substitutions_own on public.timetable_substitutions
  for all to authenticated
  using (
    slot_id in (
      select ts.id from public.timetable_slots ts
      join public.sections s on s.id = ts.section_id
      join public.classes c on c.id = s.class_id
      join public.academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    slot_id in (
      select ts.id from public.timetable_slots ts
      join public.sections s on s.id = ts.section_id
      join public.classes c on c.id = s.class_id
      join public.academic_years ay on ay.id = c.academic_year_id
      where ay.school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Backfill primary grid + cycle days for years that have periods
-- ---------------------------------------------------------------------------

insert into public.timetable_grids (
  school_id,
  academic_year_id,
  name,
  grid_type,
  cycle_length,
  is_active
)
select distinct
  ay.school_id,
  ay.id,
  'Primary weekly',
  'primary',
  6,
  true
from public.academic_years ay
where exists (
  select 1 from public.period_definitions pd where pd.academic_year_id = ay.id
)
and not exists (
  select 1 from public.timetable_grids g
  where g.academic_year_id = ay.id
    and g.grid_type = 'primary'
    and g.archived_at is null
);

-- Mon–Sat cycle days for primary grids missing days
insert into public.timetable_cycle_days (grid_id, day_index, label, maps_to_weekday)
select g.id, d.day_index, d.label, d.day_index
from public.timetable_grids g
cross join (
  values
    (1, 'Monday'),
    (2, 'Tuesday'),
    (3, 'Wednesday'),
    (4, 'Thursday'),
    (5, 'Friday'),
    (6, 'Saturday')
) as d(day_index, label)
where g.grid_type = 'primary'
  and g.archived_at is null
  and not exists (
    select 1 from public.timetable_cycle_days cd where cd.grid_id = g.id
  );

-- Attach existing slots to primary grid of their year
update public.timetable_slots ts
set grid_id = g.id
from public.sections s
join public.classes c on c.id = s.class_id
join public.timetable_grids g
  on g.academic_year_id = c.academic_year_id
 and g.grid_type = 'primary'
 and g.archived_at is null
where ts.section_id = s.id
  and ts.grid_id is null;
