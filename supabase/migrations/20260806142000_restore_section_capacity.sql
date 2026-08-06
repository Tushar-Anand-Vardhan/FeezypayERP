-- Restore per-section capacity alongside class capacity.

alter table public.sections
  add column if not exists capacity integer;

alter table public.sections
  drop constraint if exists sections_capacity_positive_chk;

alter table public.sections
  add constraint sections_capacity_positive_chk
  check (capacity is null or capacity > 0);

comment on column public.sections.capacity is
  'Optional maximum student capacity for the section. When class capacity is set, section capacities must sum to it.';
