-- Phase 2: Event & Activity Engine (E17 ops)
-- All activities originate as calendar_events (Academic Calendar / E17).
-- Participation is by reference — Student Profile reads event_participants; no event blob on students.

-- ---------------------------------------------------------------------------
-- 1. Expand calendar_events categories + house/club links
-- ---------------------------------------------------------------------------

alter table public.calendar_events
  drop constraint if exists calendar_events_category_check;

alter table public.calendar_events
  add constraint calendar_events_category_check
  check (
    category in (
      'ptm',
      'competition',
      'sports',
      'trip',
      'assembly',
      'workshop',
      'teacher_meeting',
      'annual_day',
      'club_activity',
      'house_activity',
      'cultural',
      'custom'
    )
  );

alter table public.calendar_events
  add column if not exists house_id uuid references public.houses (id) on delete set null,
  add column if not exists club_id uuid references public.clubs (id) on delete set null,
  add column if not exists photo_media_ids uuid[] not null default '{}'::uuid[],
  add column if not exists certificate_enabled boolean not null default false;

comment on column public.calendar_events.house_id is
  'Optional house scope for house_activity / inter-house events.';
comment on column public.calendar_events.club_id is
  'Optional club scope for club_activity events.';
comment on column public.calendar_events.photo_media_ids is
  'Future E27 media refs for event photos (event-level, not student dump).';
comment on column public.calendar_events.certificate_enabled is
  'When true, participation certificates may be issued via E20 student_issued_documents.';

create index if not exists calendar_events_house_idx
  on public.calendar_events (house_id)
  where house_id is not null and archived_at is null;

create index if not exists calendar_events_club_idx
  on public.calendar_events (club_id)
  where club_id is not null and archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. Teachers in charge
-- ---------------------------------------------------------------------------

create table public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events (id) on delete cascade,
  employment_id uuid not null references public.teacher_employments (id) on delete restrict,
  role text not null default 'in_charge'
    check (
      role in (
        'in_charge',
        'assistant',
        'coach',
        'judge',
        'escort',
        'other'
      )
    ),
  remarks text,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_event_id, employment_id, role)
);

comment on table public.event_staff_assignments is
  'E17 teachers/staff assigned to a calendar event (in charge, coach, etc.).';

create index event_staff_assignments_event_idx
  on public.event_staff_assignments (calendar_event_id)
  where archived_at is null;

create index event_staff_assignments_employment_idx
  on public.event_staff_assignments (employment_id)
  where archived_at is null;

alter table public.event_staff_assignments enable row level security;
revoke all on public.event_staff_assignments from anon;
grant select, insert, update on public.event_staff_assignments to authenticated;

create policy event_staff_assignments_own on public.event_staff_assignments
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Enrich event_participants (attendance, awards, certificates, media)
-- ---------------------------------------------------------------------------

alter table public.event_participants
  add column if not exists participation_role text not null default 'participant',
  add column if not exists attendance_status text,
  add column if not exists position_label text,
  add column if not exists award_label text,
  add column if not exists certificate_status text not null default 'none',
  add column if not exists certificate_document_id uuid
    references public.student_issued_documents (id) on delete set null,
  add column if not exists remarks text,
  add column if not exists attachment_media_ids uuid[] not null default '{}'::uuid[],
  add column if not exists photo_media_ids uuid[] not null default '{}'::uuid[],
  add column if not exists recorded_by uuid references auth.users (id) on delete set null,
  add column if not exists recorded_by_employment_id uuid
    references public.teacher_employments (id) on delete set null,
  add column if not exists archived_at timestamptz;

alter table public.event_participants
  drop constraint if exists event_participants_participation_role_check;

alter table public.event_participants
  add constraint event_participants_participation_role_check
  check (
    participation_role in (
      'participant',
      'captain',
      'volunteer',
      'spectator',
      'organizer_student',
      'other'
    )
  );

alter table public.event_participants
  drop constraint if exists event_participants_attendance_status_check;

alter table public.event_participants
  add constraint event_participants_attendance_status_check
  check (
    attendance_status is null
    or attendance_status in (
      'present',
      'absent',
      'late',
      'excused',
      'no_show'
    )
  );

alter table public.event_participants
  drop constraint if exists event_participants_certificate_status_check;

alter table public.event_participants
  add constraint event_participants_certificate_status_check
  check (
    certificate_status in ('none', 'pending', 'issued', 'revoked')
  );

comment on table public.event_participants is
  'E17 student participation for calendar_events. Profile reads by FK — do not copy event title/body onto students.';

comment on column public.event_participants.attachment_media_ids is
  'Future E27 media refs (certificates scans, forms) — ids only.';
comment on column public.event_participants.photo_media_ids is
  'Future E27 photo refs for this participation — ids only.';

-- ---------------------------------------------------------------------------
-- 4. Enrich competition_participations (still linked to calendar_events)
-- ---------------------------------------------------------------------------

alter table public.competition_participations
  add column if not exists event_participant_id uuid
    references public.event_participants (id) on delete set null,
  add column if not exists position_label text,
  add column if not exists award_label text;

comment on table public.competition_participations is
  'E17 competition projection linked to calendar_events + event_participants. Not a second event store.';

-- ---------------------------------------------------------------------------
-- 5. Wire club_event_links uniqueness when event set
-- ---------------------------------------------------------------------------

create unique index if not exists club_event_links_event_unique_idx
  on public.club_event_links (club_id, calendar_event_id)
  where calendar_event_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Link issued certificates back to events
-- ---------------------------------------------------------------------------

alter table public.student_issued_documents
  add column if not exists calendar_event_id uuid
    references public.calendar_events (id) on delete set null,
  add column if not exists event_participant_id uuid
    references public.event_participants (id) on delete set null;

create index if not exists student_issued_documents_event_idx
  on public.student_issued_documents (calendar_event_id)
  where calendar_event_id is not null;

-- ---------------------------------------------------------------------------
-- 7. Audit log
-- ---------------------------------------------------------------------------

create table public.event_activity_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  calendar_event_id uuid references public.calendar_events (id) on delete set null,
  event_participant_id uuid references public.event_participants (id) on delete set null,
  employment_id uuid references public.teacher_employments (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

comment on table public.event_activity_audit_log is
  'E17 append-only audit for activity staffing, participation, awards, certificates.';

create index event_activity_audit_school_idx
  on public.event_activity_audit_log (school_id, created_at desc);

alter table public.event_activity_audit_log enable row level security;
revoke all on public.event_activity_audit_log from anon;
grant select, insert on public.event_activity_audit_log to authenticated;

create policy event_activity_audit_select on public.event_activity_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy event_activity_audit_insert on public.event_activity_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
