-- Phase 1: Report Card Template Engine (E20 Document config surface)
-- Templates, boards, scopes, layout blocks, assessment refs.
-- NO issued PDFs / marks snapshots / digital signature crypto in this migration.

-- ---------------------------------------------------------------------------
-- 1. Boards (admin-configurable affiliation catalog for templates)
-- ---------------------------------------------------------------------------

create table public.report_card_boards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_card_boards is
  'E20 board catalog for report-card template scoping (CBSE, ICSE, …).';

create unique index report_card_boards_school_active_code_unique_idx
  on public.report_card_boards (school_id, lower(code))
  where archived_at is null;

create unique index report_card_boards_school_active_name_unique_idx
  on public.report_card_boards (school_id, lower(name))
  where archived_at is null;

alter table public.report_card_boards enable row level security;
revoke all on public.report_card_boards from anon;
grant select, insert, update on public.report_card_boards to authenticated;

create policy report_card_boards_own on public.report_card_boards
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Templates
-- ---------------------------------------------------------------------------

create table public.report_card_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  board_id uuid references public.report_card_boards (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  status text not null default 'draft',
  layout_config jsonb not null default '{}'::jsonb,
  include_grades boolean not null default true,
  include_remarks boolean not null default true,
  include_attendance boolean not null default true,
  include_co_curricular boolean not null default true,
  include_teacher_comments boolean not null default true,
  include_principal_comments boolean not null default true,
  include_signatures boolean not null default true,
  pdf_generation_enabled boolean not null default false,
  digital_signature_enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status in ('draft', 'published', 'retired')
  )
);

comment on table public.report_card_templates is
  'E20 report card templates. Layout + assessment refs; no duplicated marks.';
comment on column public.report_card_templates.layout_config is
  'JSON: page_size, orientation, margins, theme, custom_css_vars, …';
comment on column public.report_card_templates.pdf_generation_enabled is
  'FUTURE PDF generation flag.';
comment on column public.report_card_templates.digital_signature_enabled is
  'FUTURE digital signature flag.';

create unique index report_card_templates_school_active_code_unique_idx
  on public.report_card_templates (school_id, lower(code))
  where archived_at is null;

create unique index report_card_templates_school_active_name_unique_idx
  on public.report_card_templates (school_id, lower(name))
  where archived_at is null;

create index report_card_templates_board_idx
  on public.report_card_templates (board_id)
  where archived_at is null;

create index report_card_templates_year_idx
  on public.report_card_templates (academic_year_id)
  where archived_at is null;

alter table public.report_card_templates enable row level security;
revoke all on public.report_card_templates from anon;
grant select, insert, update on public.report_card_templates to authenticated;

create policy report_card_templates_own on public.report_card_templates
  for all to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  )
  with check (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Template versions (immutable snapshots on publish)
-- ---------------------------------------------------------------------------

create table public.report_card_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  version integer not null check (version >= 1),
  snapshot jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  is_immutable boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

comment on table public.report_card_template_versions is
  'E20 immutable template snapshots. Future issued ReportCards pin version id.';
comment on column public.report_card_template_versions.snapshot is
  'JSON: layout_config, blocks, assessments (exam ids), scopes, signatures, flags.';

create index report_card_template_versions_template_idx
  on public.report_card_template_versions (template_id);

alter table public.report_card_template_versions enable row level security;
revoke all on public.report_card_template_versions from anon;
grant select, insert, update on public.report_card_template_versions to authenticated;

create policy report_card_template_versions_own on public.report_card_template_versions
  for all to authenticated
  using (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Class / section scopes
-- ---------------------------------------------------------------------------

create table public.report_card_template_scopes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  class_id uuid references public.classes (id) on delete restrict,
  section_id uuid references public.sections (id) on delete restrict,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (class_id is not null or section_id is not null)
);

comment on table public.report_card_template_scopes is
  'E20 template applicability to classes and/or sections.';

create unique index report_card_template_scopes_unique_idx
  on public.report_card_template_scopes (
    template_id,
    coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where archived_at is null;

create index report_card_template_scopes_template_idx
  on public.report_card_template_scopes (template_id)
  where archived_at is null;

alter table public.report_card_template_scopes enable row level security;
revoke all on public.report_card_template_scopes from anon;
grant select, insert, update on public.report_card_template_scopes to authenticated;

create policy report_card_template_scopes_own on public.report_card_template_scopes
  for all to authenticated
  using (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Assessment bindings (REFERENCE exam_definitions — no marks copy)
-- ---------------------------------------------------------------------------

create table public.report_card_template_assessments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  exam_definition_id uuid not null references public.exam_definitions (id) on delete restrict,
  display_label text,
  display_order integer not null default 0,
  include_components boolean not null default true,
  show_max_marks boolean not null default true,
  show_pass_marks boolean not null default true,
  show_grades boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_card_template_assessments is
  'E20 → E11 assessment refs. Templates never store duplicated marks.';

create unique index report_card_template_assessments_unique_idx
  on public.report_card_template_assessments (template_id, exam_definition_id)
  where archived_at is null;

create index report_card_template_assessments_exam_idx
  on public.report_card_template_assessments (exam_definition_id)
  where archived_at is null;

alter table public.report_card_template_assessments enable row level security;
revoke all on public.report_card_template_assessments from anon;
grant select, insert, update on public.report_card_template_assessments to authenticated;

create policy report_card_template_assessments_own on public.report_card_template_assessments
  for all to authenticated
  using (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Dynamic layout blocks / sections
-- ---------------------------------------------------------------------------

create table public.report_card_template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  block_type text not null,
  title text,
  config jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    block_type in (
      'header',
      'student_info',
      'grades',
      'remarks',
      'attendance',
      'co_curricular',
      'teacher_comments',
      'principal_comments',
      'signatures',
      'custom',
      'spacer'
    )
  )
);

comment on table public.report_card_template_blocks is
  'E20 dynamic report-card sections (grades, remarks, attendance, comments, …).';
comment on column public.report_card_template_blocks.config is
  'Block-specific JSON (columns, data bindings, custom HTML/layout keys).';

create unique index report_card_template_blocks_active_title_unique_idx
  on public.report_card_template_blocks (template_id, lower(coalesce(title, block_type)), block_type)
  where archived_at is null;

create index report_card_template_blocks_template_idx
  on public.report_card_template_blocks (template_id, display_order)
  where archived_at is null;

alter table public.report_card_template_blocks enable row level security;
revoke all on public.report_card_template_blocks from anon;
grant select, insert, update on public.report_card_template_blocks to authenticated;

create policy report_card_template_blocks_own on public.report_card_template_blocks
  for all to authenticated
  using (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Signature slots (config; digital crypto FUTURE)
-- ---------------------------------------------------------------------------

create table public.report_card_template_signatures (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_card_templates (id) on delete restrict,
  role_label text not null,
  signature_type text not null default 'wet_ink',
  display_order integer not null default 0,
  requires_digital boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    signature_type in ('wet_ink', 'image_placeholder', 'digital_stub')
  )
);

comment on table public.report_card_template_signatures is
  'E20 signature slots on a template. Digital crypto/signing is FUTURE.';
comment on column public.report_card_template_signatures.requires_digital is
  'FUTURE: require digital signature when issuing.';

create unique index report_card_template_signatures_active_role_unique_idx
  on public.report_card_template_signatures (template_id, lower(role_label))
  where archived_at is null;

alter table public.report_card_template_signatures enable row level security;
revoke all on public.report_card_template_signatures from anon;
grant select, insert, update on public.report_card_template_signatures to authenticated;

create policy report_card_template_signatures_own on public.report_card_template_signatures
  for all to authenticated
  using (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  )
  with check (
    template_id in (
      select id from public.report_card_templates
      where school_id in (select school_id from profiles where profiles.id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 8. FUTURE: PDF render jobs (schema stub only — no app writers yet)
-- ---------------------------------------------------------------------------

create table public.report_card_render_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  template_version_id uuid not null
    references public.report_card_template_versions (id) on delete restrict,
  status text not null default 'queued',
  error_message text,
  media_asset_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status in ('queued', 'rendering', 'succeeded', 'failed', 'cancelled')
  )
);

comment on table public.report_card_render_jobs is
  'FUTURE E20 PDF generation jobs. Not used by app yet.';

alter table public.report_card_render_jobs enable row level security;
revoke all on public.report_card_render_jobs from anon;
grant select on public.report_card_render_jobs to authenticated;

create policy report_card_render_jobs_own_select on public.report_card_render_jobs
  for select to authenticated
  using (
    school_id in (select school_id from profiles where profiles.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 9. Seed default boards + optional starter template blocks helper data
-- ---------------------------------------------------------------------------

insert into public.report_card_boards (school_id, code, name, display_order)
select s.id, b.code, b.name, b.ord
from public.schools s
cross join (
  values
    ('CBSE', 'CBSE', 1),
    ('ICSE', 'ICSE', 2),
    ('STATE', 'State board', 3),
    ('IB', 'IB', 4),
    ('OTHER', 'Other', 5)
) as b(code, name, ord)
where not exists (
  select 1 from public.report_card_boards x
  where x.school_id = s.id and lower(x.code) = lower(b.code)
);
