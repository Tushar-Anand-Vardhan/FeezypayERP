-- School short code for branding / external refs (Wave 3 config hub).

alter table public.schools
  add column if not exists code text;

comment on column public.schools.code is
  'Optional short school code (distinct from board affiliation_number).';

create unique index if not exists schools_code_uidx
  on public.schools (lower(code))
  where code is not null and btrim(code) <> '';
