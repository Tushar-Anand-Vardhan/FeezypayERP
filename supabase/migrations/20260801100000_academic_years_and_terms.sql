-- Step 2 schema: academic years, terms, and WhatsApp reporting preference.

alter table public.schools
  add column whatsapp_report_follows_terms boolean not null default true;

comment on column public.schools.whatsapp_report_follows_terms is
  'When true, WhatsApp report schedules follow the term calendar instead of a fixed cadence.';

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.academic_years is
  'An academic year belonging to a single school tenant.';

comment on column public.academic_years.school_id is
  'The school that owns this academic year.';

comment on column public.academic_years.label is
  'Human-readable label such as 2026-27.';

comment on column public.academic_years.is_active is
  'Whether this is the school''s current active academic year. Only one may be active per school.';

create unique index academic_years_one_active_per_school_idx
  on public.academic_years (school_id)
  where is_active;

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

comment on table public.terms is
  'A named term within an academic year, with inclusive start and end dates.';

comment on column public.terms.academic_year_id is
  'The academic year this term belongs to.';

comment on column public.terms.name is
  'Display name of the term, such as Term 1 or Semester 1.';

comment on column public.terms.start_date is
  'First day of the term.';

comment on column public.terms.end_date is
  'Last day of the term; must be after start_date.';

alter table public.academic_years enable row level security;
alter table public.terms enable row level security;

revoke all on public.academic_years from anon;
revoke all on public.terms from anon;

grant select, insert, update, delete on public.academic_years to authenticated;
grant select, insert, update, delete on public.terms to authenticated;

create policy academic_years_own
  on public.academic_years
  for all
  to authenticated
  using (
    school_id in (
      select profiles.school_id
      from public.profiles
      where profiles.id = auth.uid()
    )
  )
  with check (
    school_id in (
      select profiles.school_id
      from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy terms_own
  on public.terms
  for all
  to authenticated
  using (
    academic_year_id in (
      select academic_years.id
      from public.academic_years
      where academic_years.school_id in (
        select profiles.school_id
        from public.profiles
        where profiles.id = auth.uid()
      )
    )
  )
  with check (
    academic_year_id in (
      select academic_years.id
      from public.academic_years
      where academic_years.school_id in (
        select profiles.school_id
        from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );
