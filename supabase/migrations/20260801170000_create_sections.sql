-- Step 4 schema: sections per class.

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  capacity integer,
  display_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.sections is
  'A named section within a class, such as A or B.';

comment on column public.sections.capacity is
  'Optional maximum student capacity for the section.';

comment on column public.sections.display_order is
  'Zero-based position of the section within the class list.';

create unique index sections_class_name_unique_idx
  on public.sections (class_id, lower(name));

alter table public.sections
  add constraint sections_capacity_positive_chk
  check (capacity is null or capacity > 0);

alter table public.sections enable row level security;

revoke all on public.sections from anon;
grant select, insert, update, delete on public.sections to authenticated;

create policy sections_own
  on public.sections
  for all
  to authenticated
  using (
    class_id in (
      select id from classes
      where academic_year_id in (
        select id from academic_years
        where school_id in (select school_id from profiles where profiles.id = auth.uid())
      )
    )
  )
  with check (
    class_id in (
      select id from classes
      where academic_year_id in (
        select id from academic_years
        where school_id in (select school_id from profiles where profiles.id = auth.uid())
      )
    )
  );
