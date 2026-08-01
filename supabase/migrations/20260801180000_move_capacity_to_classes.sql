-- Move capacity from sections to classes.

alter table public.sections drop constraint sections_capacity_positive_chk;
alter table public.sections drop column capacity;

alter table public.classes add column capacity integer;

alter table public.classes
  add constraint classes_capacity_positive_chk
  check (capacity is null or capacity > 0);
