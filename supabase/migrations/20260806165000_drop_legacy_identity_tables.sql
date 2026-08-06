-- Drop legacy school-scoped identity tables after cutover.

drop table if exists public.teacher_subjects_legacy cascade;
drop table if exists public.teachers_legacy cascade;
drop table if exists public.student_section_enrollments_legacy cascade;
drop table if exists public.student_guardians_legacy cascade;
drop table if exists public.guardians_legacy cascade;
drop table if exists public.students_legacy cascade;

-- Optional map tables can remain for audit; drop if not needed long-term.
-- Keep teacher_id_map / student_id_map for one release cycle.
