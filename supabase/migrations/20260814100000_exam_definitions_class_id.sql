-- Exam definitions can be scoped to a class. Null class_id remains school-wide
-- (legacy / teacher-created assessments that only pin class on the schedule).

alter table public.exam_definitions
  add column if not exists class_id uuid references public.classes (id) on delete cascade;

comment on column public.exam_definitions.class_id is
  'Optional class scope. Null = school-wide. Onboarding writes one definition set per class.';

drop index if exists public.exam_definitions_year_active_name_unique_idx;

create unique index exam_definitions_year_class_active_name_uidx
  on public.exam_definitions (academic_year_id, class_id, lower(name))
  where archived_at is null and class_id is not null;

create unique index exam_definitions_year_schoolwide_active_name_uidx
  on public.exam_definitions (academic_year_id, lower(name))
  where archived_at is null and class_id is null;

create index if not exists exam_definitions_class_idx
  on public.exam_definitions (class_id)
  where archived_at is null and class_id is not null;
