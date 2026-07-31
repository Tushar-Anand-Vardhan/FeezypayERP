-- School identity fields for onboarding step 1, plus scoped logo storage.

alter table public.schools
  add column logo_path text,
  add column address_street text,
  add column address_city text,
  add column address_state text,
  add column address_pincode text,
  add column contact_phone text,
  add column contact_email text,
  add column board text,
  add column affiliation_number text,
  add column academic_year_start_month smallint;

comment on column public.schools.logo_path is
  'Storage object path for the school logo in the school-logos bucket.';

comment on column public.schools.address_street is
  'Street address of the school.';

comment on column public.schools.address_city is
  'City where the school is located.';

comment on column public.schools.address_state is
  'State or region where the school is located.';

comment on column public.schools.address_pincode is
  'Postal or PIN code for the school address.';

comment on column public.schools.contact_phone is
  'Primary contact phone number for the school.';

comment on column public.schools.contact_email is
  'Primary contact email address for the school.';

comment on column public.schools.board is
  'Education board the school is affiliated with (CBSE, ICSE, State, IB, or Other).';

comment on column public.schools.affiliation_number is
  'Optional board affiliation or registration number.';

comment on column public.schools.academic_year_start_month is
  'Month (1–12) when the academic year begins.';

alter table public.schools
  add constraint schools_board_check
    check (board is null or board in ('CBSE', 'ICSE', 'State', 'IB', 'Other'));

alter table public.schools
  add constraint schools_academic_year_start_month_check
    check (
      academic_year_start_month is null
      or (academic_year_start_month >= 1 and academic_year_start_month <= 12)
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-logos',
  'school-logos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy school_logos_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = (
      select profiles.school_id::text
      from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy school_logos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = (
      select profiles.school_id::text
      from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy school_logos_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = (
      select profiles.school_id::text
      from public.profiles
      where profiles.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = (
      select profiles.school_id::text
      from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy school_logos_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = (
      select profiles.school_id::text
      from public.profiles
      where profiles.id = auth.uid()
    )
  );
