-- Term structure as recurring month/day pairs (year-agnostic), with
-- materialized dates for the active academic year for querying.

alter table public.terms
  drop constraint if exists terms_no_overlap_per_academic_year_excl;

alter table public.terms
  drop constraint if exists terms_end_after_start_chk;

alter table public.terms
  add column start_month smallint,
  add column start_day smallint,
  add column end_month smallint,
  add column end_day smallint;

-- Backfill month/day from existing date columns when present.
update public.terms
set
  start_month = extract(month from start_date)::smallint,
  start_day = extract(day from start_date)::smallint,
  end_month = extract(month from end_date)::smallint,
  end_day = extract(day from end_date)::smallint
where start_date is not null and end_date is not null;

alter table public.terms
  alter column start_month set not null,
  alter column start_day set not null,
  alter column end_month set not null,
  alter column end_day set not null;

alter table public.terms
  alter column start_date drop not null,
  alter column end_date drop not null;

alter table public.terms
  add constraint terms_start_month_chk
    check (start_month between 1 and 12),
  add constraint terms_end_month_chk
    check (end_month between 1 and 12),
  add constraint terms_start_day_chk
    check (start_day between 1 and 31),
  add constraint terms_end_day_chk
    check (end_day between 1 and 31);

comment on column public.terms.start_month is
  'Recurring start month (1-12) within the academic year cycle.';
comment on column public.terms.start_day is
  'Recurring start day of month within the academic year cycle.';
comment on column public.terms.end_month is
  'Recurring end month (1-12) within the academic year cycle.';
comment on column public.terms.end_day is
  'Recurring end day of month within the academic year cycle.';
comment on column public.terms.start_date is
  'Optional materialized start date for the active academic year.';
comment on column public.terms.end_date is
  'Optional materialized end date for the active academic year.';
