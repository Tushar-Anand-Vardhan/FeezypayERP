-- Marking window for subject schedules (Wave 1 / use-case roadmap).
-- When both null, teachers may enter marks until the mark session is locked.

alter table public.exam_subject_schedules
  add column if not exists marking_opens_at timestamptz,
  add column if not exists marking_closes_at timestamptz;

comment on column public.exam_subject_schedules.marking_opens_at is
  'Optional UTC time when teachers may begin entering marks for this schedule.';

comment on column public.exam_subject_schedules.marking_closes_at is
  'Optional UTC time after which teachers cannot enter/edit marks (session lock still applies).';
