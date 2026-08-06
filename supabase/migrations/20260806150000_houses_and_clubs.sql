-- Houses, clubs, and school flags for optional setup + timetable skip.

alter table public.schools
  add column if not exists houses_enabled boolean not null default false,
  add column if not exists clubs_enabled boolean not null default false,
  add column if not exists timetable_skipped boolean not null default false;

comment on column public.schools.houses_enabled is
  'Whether the school uses houses.';
comment on column public.schools.clubs_enabled is
  'Whether the school uses clubs.';
comment on column public.schools.timetable_skipped is
  'When true, admin skipped timetable setup during onboarding.';

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index houses_school_name_unique_idx
  on public.houses (school_id, lower(name));

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index clubs_school_name_unique_idx
  on public.clubs (school_id, lower(name));

alter table public.houses enable row level security;
alter table public.clubs enable row level security;

revoke all on public.houses from anon;
revoke all on public.clubs from anon;
grant select, insert, update, delete on public.houses to authenticated;
grant select, insert, update, delete on public.clubs to authenticated;

create policy houses_own on public.houses for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));

create policy clubs_own on public.clubs for all to authenticated
  using (school_id in (select school_id from profiles where profiles.id = auth.uid()))
  with check (school_id in (select school_id from profiles where profiles.id = auth.uid()));
