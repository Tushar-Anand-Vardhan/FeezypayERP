-- Step 3 schema: classes per academic year.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  display_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.classes is
  'A named class or grade within an academic year.';

comment on column public.classes.display_order is
  'Zero-based position of the class within the academic year list.';

create unique index classes_academic_year_name_unique_idx
  on public.classes (academic_year_id, lower(name));

alter table public.classes enable row level security;

revoke all on public.classes from anon;
grant select, insert, update, delete on public.classes to authenticated;

create policy classes_own
  on public.classes
  for all
  to authenticated
  using (
    academic_year_id in (
      select id from academic_years
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    academic_year_id in (
      select id from academic_years
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );
