-- Phase 2: Report Card Engine (E20 issue / generation)
-- Generates cards from source engines; pins template version; issue version history.
-- Does NOT store a parallel marks OLTP — source_refs point at exam_results / attendance.

-- ---------------------------------------------------------------------------
-- 1. Report card issues (logical document)
-- ---------------------------------------------------------------------------

create table public.report_card_issues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id) on delete restrict,
  student_academic_year_id uuid
    references public.student_academic_years (id) on delete set null,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  term_id uuid references public.terms (id) on delete set null,
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  current_version_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'revoked')),
  title text not null,
  created_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_card_issues is
  'E20 logical report card per student × template × year/term. Versions hold history.';

create unique index report_card_issues_unique_idx
  on public.report_card_issues (
    student_profile_id,
    template_id,
    academic_year_id,
    coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

create index report_card_issues_school_status_idx
  on public.report_card_issues (school_id, status);

create index report_card_issues_student_idx
  on public.report_card_issues (student_profile_id, academic_year_id);

alter table public.report_card_issues enable row level security;
revoke all on public.report_card_issues from anon;
grant select, insert, update on public.report_card_issues to authenticated;

create policy report_card_issues_own on public.report_card_issues
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Issue versions (immutable history after issue)
-- ---------------------------------------------------------------------------

create table public.report_card_issue_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  issue_id uuid not null references public.report_card_issues (id) on delete cascade,
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'superseded', 'revoked')),
  template_version_id uuid
    references public.report_card_template_versions (id) on delete set null,
  -- Pointers only — never a second exam_results table
  source_refs jsonb not null default '{}'::jsonb,
  -- Derived presentation at generate/issue time (labels, aggregated %, remarks copy for reprint)
  presentation_snapshot jsonb not null default '{}'::jsonb,
  teacher_remarks text,
  principal_remarks text,
  promotion_status text,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  superseded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, version)
);

comment on table public.report_card_issue_versions is
  'E20 report card version history. source_refs point at E11/E12/E13 facts; presentation_snapshot is reprint display only.';

comment on column public.report_card_issue_versions.source_refs is
  'JSON pointers: exam_result_ids[], attendance query keys, conduct_incident_ids[], membership ids — not duplicated marks rows.';

comment on column public.report_card_issue_versions.presentation_snapshot is
  'Derived display payload assembled from sources at generate/issue. Not OLTP SoT for assessments.';

create index report_card_issue_versions_issue_idx
  on public.report_card_issue_versions (issue_id, version desc);

create index report_card_issue_versions_status_idx
  on public.report_card_issue_versions (school_id, status);

alter table public.report_card_issue_versions enable row level security;
revoke all on public.report_card_issue_versions from anon;
grant select, insert, update on public.report_card_issue_versions to authenticated;

create policy report_card_issue_versions_own on public.report_card_issue_versions
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

alter table public.report_card_issues
  add constraint report_card_issues_current_version_fk
  foreign key (current_version_id)
  references public.report_card_issue_versions (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Enrich student_issued_documents + render jobs link
-- ---------------------------------------------------------------------------

alter table public.student_issued_documents
  add column if not exists report_card_issue_id uuid
    references public.report_card_issues (id) on delete set null,
  add column if not exists report_card_issue_version_id uuid
    references public.report_card_issue_versions (id) on delete set null,
  add column if not exists template_version_id uuid
    references public.report_card_template_versions (id) on delete set null;

create index if not exists student_issued_documents_issue_idx
  on public.student_issued_documents (report_card_issue_id)
  where report_card_issue_id is not null;

comment on table public.student_issued_documents is
  'E20 issued artifacts. Report cards link report_card_issue(_version); PDF bytes later via Media.';

-- Allow authenticated to insert/update render jobs for future PDF pipeline
grant insert, update on public.report_card_render_jobs to authenticated;

drop policy if exists report_card_render_jobs_own_select on public.report_card_render_jobs;
drop policy if exists report_card_render_jobs_own on public.report_card_render_jobs;

create policy report_card_render_jobs_own on public.report_card_render_jobs
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

alter table public.report_card_render_jobs
  add column if not exists report_card_issue_version_id uuid
    references public.report_card_issue_versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Engine audit (issue lifecycle)
-- ---------------------------------------------------------------------------

create table public.report_card_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  issue_id uuid references public.report_card_issues (id) on delete set null,
  issue_version_id uuid
    references public.report_card_issue_versions (id) on delete set null,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

comment on table public.report_card_audit_log is
  'E20 append-only audit for report card generate / issue / reissue / revoke.';

create index report_card_audit_school_idx
  on public.report_card_audit_log (school_id, created_at desc);

alter table public.report_card_audit_log enable row level security;
revoke all on public.report_card_audit_log from anon;
grant select, insert on public.report_card_audit_log to authenticated;

create policy report_card_audit_select on public.report_card_audit_log
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

create policy report_card_audit_insert on public.report_card_audit_log
  for insert to authenticated
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );
