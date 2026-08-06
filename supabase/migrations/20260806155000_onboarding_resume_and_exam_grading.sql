-- Track houses/clubs step completion for onboarding resume, and persist exam grading type.

alter table public.schools
  add column if not exists houses_clubs_completed boolean not null default false;

comment on column public.schools.houses_clubs_completed is
  'True after the admin has saved the Houses & Clubs onboarding step (even if skipped/empty).';

alter table public.exam_definitions
  add column if not exists grading_type text not null default 'marks'
    check (grading_type in ('marks', 'letter_grade', 'rubric'));

comment on column public.exam_definitions.grading_type is
  'Default grading type for this exam definition.';
