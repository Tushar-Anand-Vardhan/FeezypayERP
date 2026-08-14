-- Allow zero period and named day-structure kinds (class teacher, teaching, break).

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.period_definitions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ~ 'period_number\s*>\s*0';
  if cname is not null then
    execute format('alter table public.period_definitions drop constraint %I', cname);
  end if;
end $$;

alter table public.period_definitions
  add constraint period_definitions_period_number_check
  check (period_number >= 0);

alter table public.period_definitions
  add column if not exists period_kind text not null default 'teaching';

alter table public.period_definitions
  drop constraint if exists period_definitions_period_kind_check;

alter table public.period_definitions
  add constraint period_definitions_period_kind_check
  check (period_kind in ('teaching', 'class_teacher', 'break'));

update public.period_definitions
  set period_kind = 'break'
  where is_break = true
    and period_kind is distinct from 'break';

update public.period_definitions
  set period_kind = 'class_teacher'
  where period_number = 0
    and is_break = false
    and period_kind = 'teaching';

comment on column public.period_definitions.period_kind is
  'Day-structure kind: teaching period, class teacher / zero period, or break/lunch.';
