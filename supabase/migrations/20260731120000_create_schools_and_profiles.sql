-- Stage 1: Core multi-tenant schema for schools and user profiles.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled school',
  onboarding_status text not null default 'in_progress'
    check (onboarding_status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.schools is
  'A tenant school in the ERP. Each school owns its own data boundary in the multi-tenant system.';

comment on column public.schools.id is
  'Primary key for the school tenant.';

comment on column public.schools.name is
  'Display name of the school, set during onboarding or administration.';

comment on column public.schools.onboarding_status is
  'Whether the school has finished initial setup (in_progress) or is fully onboarded (completed).';

comment on column public.schools.created_at is
  'When this school row was first created.';

comment on column public.schools.updated_at is
  'When this school row was last modified.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'school_admin'
    check (role in ('school_admin')),
  school_id uuid not null references public.schools (id) on delete restrict,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each authenticated user, linking them to exactly one school and role.';

comment on column public.profiles.id is
  'Matches auth.users.id — one profile per Supabase Auth user.';

comment on column public.profiles.role is
  'Application role for authorization. Only school_admin exists in this foundation stage.';

comment on column public.profiles.school_id is
  'The school this user belongs to. Set once at signup by the provisioning trigger.';

comment on column public.profiles.full_name is
  'Optional display name the user may update on their own profile.';

comment on column public.profiles.created_at is
  'When this profile row was first created.';

comment on column public.profiles.updated_at is
  'When this profile row was last modified.';

create index profiles_school_id_idx on public.profiles (school_id);
