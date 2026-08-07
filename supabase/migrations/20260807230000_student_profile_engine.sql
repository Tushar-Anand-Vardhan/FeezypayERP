-- Phase 2: Student Profile Engine — SCHEMA-READY operational stubs.
-- Profile aggregator (lib/student-profile) reads these; it does NOT duplicate rows.
-- Owning engines fill tables later (E11 results, E12 attendance, E13/E14, E17, E20, transport).

-- ---------------------------------------------------------------------------
-- Helpers: school membership via admission
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Attendance (E12)
-- ---------------------------------------------------------------------------

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  section_id uuid references public.sections (id) on delete set null,
  attendance_date date not null,
  status text not null
    check (status in ('present', 'absent', 'late', 'half_day', 'excused')),
  period_definition_id uuid references public.period_definitions (id) on delete set null,
  recorded_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attendance_records is
  'E12 SCHEMA-READY presence facts. Student Profile aggregates; never copy into student_profiles.';

create unique index attendance_records_daily_unique_idx
  on public.attendance_records (
    student_profile_id,
    attendance_date,
    coalesce(period_definition_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index attendance_records_student_date_idx
  on public.attendance_records (student_profile_id, attendance_date desc);

create index attendance_records_school_date_idx
  on public.attendance_records (school_id, attendance_date);

alter table public.attendance_records enable row level security;
revoke all on public.attendance_records from anon;
grant select, insert, update on public.attendance_records to authenticated;
-- no delete — archive/correct via status updates later

create policy attendance_records_own on public.attendance_records
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
    and student_profile_id in (
      select student_profile_id from public.student_admissions
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Exam results (E11) — append-oriented; no marks UI yet
-- ---------------------------------------------------------------------------

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  exam_definition_id uuid not null references public.exam_definitions (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  marks_obtained numeric(8, 2),
  max_marks numeric(8, 2),
  grade_label text,
  is_absent boolean not null default false,
  entered_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.exam_results is
  'E11 SCHEMA-READY marks. Append/correct via owning engine; Student Profile reads only.';

create unique index exam_results_unique_idx
  on public.exam_results (student_profile_id, exam_definition_id, subject_id);

create index exam_results_student_idx
  on public.exam_results (student_profile_id, academic_year_id);

alter table public.exam_results enable row level security;
revoke all on public.exam_results from anon;
grant select, insert, update on public.exam_results to authenticated;

create policy exam_results_own on public.exam_results
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Conduct (E13)
-- ---------------------------------------------------------------------------

create table public.conduct_incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  occurred_on date not null default current_date,
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null default 'other',
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  recorded_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.conduct_incidents is
  'E13 SCHEMA-READY behaviour incidents. Aggregated on Student Profile.';

create index conduct_incidents_student_idx
  on public.conduct_incidents (student_profile_id, occurred_on desc)
  where archived_at is null;

alter table public.conduct_incidents enable row level security;
revoke all on public.conduct_incidents from anon;
grant select, insert, update on public.conduct_incidents to authenticated;

create policy conduct_incidents_own on public.conduct_incidents
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Medical incidents (E14) — attrs remain on student_profiles
-- ---------------------------------------------------------------------------

create table public.medical_incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  occurred_on date not null default current_date,
  title text not null,
  description text,
  severity text not null default 'info'
    check (severity in ('info', 'watch', 'urgent')),
  recorded_by uuid references auth.users (id) on delete set null,
  media_ids uuid[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.medical_incidents is
  'E14 SCHEMA-READY incidents. Lifelong blood_group/medical_notes stay on student_profiles.';

create index medical_incidents_student_idx
  on public.medical_incidents (student_profile_id, occurred_on desc)
  where archived_at is null;

alter table public.medical_incidents enable row level security;
revoke all on public.medical_incidents from anon;
grant select, insert, update on public.medical_incidents to authenticated;

create policy medical_incidents_own on public.medical_incidents
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. Achievements
-- ---------------------------------------------------------------------------

create table public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  title text not null,
  category text not null default 'other',
  awarded_on date,
  description text,
  evidence_media_ids uuid[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_achievements is
  'SCHEMA-READY awards/achievements. Read by Student Profile; no duplicate dump on profile row.';

create index student_achievements_student_idx
  on public.student_achievements (student_profile_id)
  where archived_at is null;

alter table public.student_achievements enable row level security;
revoke all on public.student_achievements from anon;
grant select, insert, update on public.student_achievements to authenticated;

create policy student_achievements_own on public.student_achievements
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. Competitions (E17 satellite)
-- ---------------------------------------------------------------------------

create table public.competition_participations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  calendar_event_id uuid references public.calendar_events (id) on delete set null,
  title text not null,
  role text not null default 'participant',
  result_label text,
  participated_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.competition_participations is
  'E17 SCHEMA-READY competition entries linked optionally to calendar_events.';

create index competition_participations_student_idx
  on public.competition_participations (student_profile_id)
  where archived_at is null;

alter table public.competition_participations enable row level security;
revoke all on public.competition_participations from anon;
grant select, insert, update on public.competition_participations to authenticated;

create policy competition_participations_own on public.competition_participations
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Event participants / RSVP (E17)
-- ---------------------------------------------------------------------------

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  rsvp_status text not null default 'invited'
    check (rsvp_status in ('invited', 'accepted', 'declined', 'attended', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_event_id, student_profile_id)
);

comment on table public.event_participants is
  'E17 SCHEMA-READY per-student event participation / RSVP.';

create index event_participants_student_idx
  on public.event_participants (student_profile_id);

alter table public.event_participants enable row level security;
revoke all on public.event_participants from anon;
grant select, insert, update on public.event_participants to authenticated;

create policy event_participants_own on public.event_participants
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. Issued documents (E20)
-- ---------------------------------------------------------------------------

create table public.student_issued_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  document_kind text not null default 'other'
    check (
      document_kind in (
        'report_card',
        'transfer_certificate',
        'bonafide',
        'id_card',
        'certificate',
        'other'
      )
    ),
  title text not null,
  template_id uuid references public.report_card_templates (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  issued_on date,
  media_path text,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'revoked')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.student_issued_documents is
  'E20 SCHEMA-READY issued artifacts. Templates remain E20 config; PDF bytes later via Media.';

create index student_issued_documents_student_idx
  on public.student_issued_documents (student_profile_id)
  where archived_at is null;

alter table public.student_issued_documents enable row level security;
revoke all on public.student_issued_documents from anon;
grant select, insert, update on public.student_issued_documents to authenticated;

create policy student_issued_documents_own on public.student_issued_documents
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 9. Transport (satellite — SCHEMA-READY)
-- ---------------------------------------------------------------------------

create table public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  route_name text not null,
  stop_name text,
  vehicle_label text,
  pickup_time time,
  drop_time time,
  effective_from date not null default current_date,
  effective_to date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on table public.student_transport_assignments is
  'Transport satellite SCHEMA-READY. Fee/transport policy runtime still deferred.';

create index student_transport_assignments_student_idx
  on public.student_transport_assignments (student_profile_id)
  where archived_at is null;

alter table public.student_transport_assignments enable row level security;
revoke all on public.student_transport_assignments from anon;
grant select, insert, update on public.student_transport_assignments to authenticated;

create policy student_transport_assignments_own on public.student_transport_assignments
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
