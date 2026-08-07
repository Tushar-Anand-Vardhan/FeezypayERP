-- Phase 3: Student Achievement Engine (E35)
-- Permanent profile projection of calendar activities + manual awards.
-- Origin = Academic Calendar (calendar_events). No duplicated event SoT.

-- ---------------------------------------------------------------------------
-- 1. Enrich student_achievements (was SCHEMA-READY)
-- ---------------------------------------------------------------------------

alter table public.student_achievements
  add column if not exists source text not null default 'manual',
  add column if not exists calendar_event_id uuid
    references public.calendar_events (id) on delete set null,
  add column if not exists event_participant_id uuid
    references public.event_participants (id) on delete set null,
  add column if not exists term_id uuid
    references public.terms (id) on delete set null,
  add column if not exists participation_role text,
  add column if not exists attendance_status text,
  add column if not exists award_label text,
  add column if not exists position_label text,
  add column if not exists certificate_status text not null default 'none',
  add column if not exists certificate_document_id uuid
    references public.student_issued_documents (id) on delete set null,
  add column if not exists points numeric(10, 2)
    check (points is null or points >= 0),
  add column if not exists remarks text,
  add column if not exists photo_media_ids uuid[] not null default '{}',
  add column if not exists attachment_media_ids uuid[] not null default '{}',
  add column if not exists visibility text not null default 'school',
  add column if not exists visible_to_guardians boolean not null default true,
  add column if not exists visible_to_students boolean not null default true,
  add column if not exists recorded_by uuid references auth.users (id) on delete set null,
  add column if not exists recorded_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

-- Backfill evidence_media_ids into attachment_media_ids where empty
update public.student_achievements
set attachment_media_ids = evidence_media_ids
where coalesce(cardinality(attachment_media_ids), 0) = 0
  and coalesce(cardinality(evidence_media_ids), 0) > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_achievements_source_check'
  ) then
    alter table public.student_achievements
      add constraint student_achievements_source_check
      check (
        source in (
          'calendar_event',
          'manual',
          'competition',
          'import'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_achievements_visibility_check'
  ) then
    alter table public.student_achievements
      add constraint student_achievements_visibility_check
      check (
        visibility in (
          'private',
          'staff',
          'parent_visible',
          'school'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_achievements_certificate_status_check'
  ) then
    alter table public.student_achievements
      add constraint student_achievements_certificate_status_check
      check (
        certificate_status in ('none', 'pending', 'issued', 'revoked')
      );
  end if;
end $$;

comment on table public.student_achievements is
  'E35 permanent student achievement profile. Calendar-linked rows reference calendar_events / event_participants — never duplicate event title/date SoT.';

comment on column public.student_achievements.calendar_event_id is
  'Origin activity on Academic Calendar. Join for title/dates; do not copy as SoT.';

comment on column public.student_achievements.event_participant_id is
  '1:1 link to E17 participation — prevents duplicate achievement rows per participation.';

comment on column public.student_achievements.title is
  'Display label. For calendar-linked rows this is a snapshot at record time; prefer joining calendar_events for live title.';

create unique index if not exists student_achievements_participant_uidx
  on public.student_achievements (event_participant_id)
  where event_participant_id is not null and archived_at is null;

create index if not exists student_achievements_event_idx
  on public.student_achievements (calendar_event_id)
  where archived_at is null and calendar_event_id is not null;

create index if not exists student_achievements_year_idx
  on public.student_achievements (school_id, academic_year_id, awarded_on desc)
  where archived_at is null;

create index if not exists student_achievements_timeline_idx
  on public.student_achievements (student_profile_id, awarded_on desc, created_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. FUTURE AI summaries stub
-- ---------------------------------------------------------------------------

create table if not exists public.student_achievement_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null
    references public.student_profiles (id) on delete cascade,
  academic_year_id uuid
    references public.academic_years (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  prompt_fingerprint text,
  input_achievement_ids uuid[] not null default '{}',
  summary_text text,
  model_id text,
  error_message text,
  requested_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_achievement_ai_summaries is
  'E35 FUTURE AI summary jobs over achievement timelines. No provider calls in v1.';

create index if not exists student_achievement_ai_summaries_student_idx
  on public.student_achievement_ai_summaries (
    student_profile_id, created_at desc
  );

-- ---------------------------------------------------------------------------
-- 3. Audit
-- ---------------------------------------------------------------------------

create table if not exists public.student_achievement_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  achievement_id uuid
    references public.student_achievements (id) on delete set null,
  student_profile_id uuid
    references public.student_profiles (id) on delete set null,
  calendar_event_id uuid
    references public.calendar_events (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_achievement_audit_log_school_idx
  on public.student_achievement_audit_log (school_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS for new tables (+ keep achievements grants)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'student_achievement_ai_summaries',
    'student_achievement_audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    if t = 'student_achievement_audit_log' then
      execute format('grant select, insert on public.%I to authenticated', t);
      execute format(
        'create policy %I_select on public.%I for select to authenticated
           using (school_id in (select public.membership_schools(auth.uid())))',
        t, t
      );
      execute format(
        'create policy %I_insert on public.%I for insert to authenticated
           with check (school_id in (select public.membership_schools(auth.uid())))',
        t, t
      );
    else
      execute format(
        'grant select, insert, update on public.%I to authenticated',
        t
      );
      execute format(
        'create policy %I_own on public.%I for all to authenticated
           using (school_id in (select public.membership_schools(auth.uid())))
           with check (school_id in (select public.membership_schools(auth.uid())))',
        t, t
      );
    end if;
  end loop;
end $$;

revoke delete on public.student_achievements from authenticated;

-- ---------------------------------------------------------------------------
-- 5. AuthZ
-- ---------------------------------------------------------------------------

insert into public.authz_permissions (key, domain, description) values
  (
    'student_achievement.read',
    'student_achievement',
    'Read student achievements / timeline'
  ),
  (
    'student_achievement.record',
    'student_achievement',
    'Record or sync achievements from calendar activities'
  ),
  (
    'student_achievement.archive',
    'student_achievement',
    'Soft-archive achievement profile rows'
  )
on conflict (key) do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('student_achievement.read'),
    ('student_achievement.record'),
    ('student_achievement.archive')
) as p(key)
where r.is_system = true
  and r.code in ('school_admin', 'principal', 'vice_principal', 'hod')
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, p.key
from public.authz_roles r
cross join (
  values
    ('student_achievement.read'),
    ('student_achievement.record')
) as p(key)
where r.is_system = true
  and r.code = 'teacher'
on conflict do nothing;

insert into public.authz_role_permissions (role_id, permission_key)
select r.id, 'student_achievement.read'
from public.authz_roles r
where r.is_system = true
  and r.code in ('student', 'parent')
on conflict do nothing;
