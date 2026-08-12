-- Wave 4: D14 one active admission per student profile (global).
-- D15 one active employment per teacher profile (global).

create unique index if not exists student_admissions_profile_active_global_uidx
  on public.student_admissions (student_profile_id)
  where status = 'active';

comment on index public.student_admissions_profile_active_global_uidx is
  'D14: a student profile may have at most one active admission across all schools.';

create unique index if not exists teacher_employments_profile_active_global_uidx
  on public.teacher_employments (teacher_profile_id)
  where status = 'active';

comment on index public.teacher_employments_profile_active_global_uidx is
  'D15: a teacher profile may have at most one active employment across all schools.';
