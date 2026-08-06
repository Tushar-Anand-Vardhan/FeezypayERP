-- Global persons foundation + readable ID sequences.

create sequence if not exists public.person_global_id_seq;
create sequence if not exists public.teacher_global_id_seq;
create sequence if not exists public.student_global_id_seq;
create sequence if not exists public.parent_global_id_seq;

create or replace function public.next_global_id(prefix text, seq regclass)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  execute format('select nextval(%L)', seq::text) into n;
  return prefix || lpad(n::text, 8, '0');
end;
$$;

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  global_id text not null unique,
  full_name text not null,
  first_name text,
  last_name text,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  email text,
  phone text,
  aadhaar_hash text,
  aadhaar_last4 text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  photo_path text,
  address text,
  auth_user_id uuid references auth.users (id) on delete set null,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index persons_email_unique_idx
  on public.persons (lower(email))
  where email is not null;

create unique index persons_aadhaar_hash_unique_idx
  on public.persons (aadhaar_hash)
  where aadhaar_hash is not null;

create unique index persons_auth_user_unique_idx
  on public.persons (auth_user_id)
  where auth_user_id is not null;

create or replace function public.persons_set_global_id()
returns trigger
language plpgsql
as $$
begin
  if new.global_id is null or new.global_id = '' then
    new.global_id := public.next_global_id('PER', 'public.person_global_id_seq');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger persons_set_global_id_trg
  before insert or update on public.persons
  for each row execute function public.persons_set_global_id();

alter table public.persons enable row level security;

revoke all on public.persons from anon;
grant select, insert, update on public.persons to authenticated;

-- Temporary broad insert for onboarding; tightened in later teacher/student policies.
create policy persons_authenticated_insert on public.persons
  for insert to authenticated
  with check (auth.uid() is not null);

create policy persons_authenticated_select on public.persons
  for select to authenticated
  using (auth.uid() is not null);

create policy persons_authenticated_update on public.persons
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

comment on table public.persons is
  'Global human identity. Never stores school-specific fields.';
comment on column public.persons.aadhaar_hash is
  'SHA-256 of normalized 12-digit Aadhaar; uniqueness key. Never store plaintext.';
comment on column public.persons.aadhaar_last4 is
  'Last 4 digits for display only.';
