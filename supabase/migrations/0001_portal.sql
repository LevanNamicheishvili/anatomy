-- School portal: schools, school applications and user profiles.
--
-- Accounts are never self-service: a school applies, a super admin approves it and creates the school
-- admin, and the school admin creates teachers and students. All writes go through the app's server
-- (service role), which checks the caller's role first; Row Level Security keeps every table closed to
-- direct client access apart from reading your own profile and school.

create type public.user_role as enum ('super_admin', 'school_admin', 'teacher', 'student');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.school_requests (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  city text not null,
  address text,
  contact_name text not null,
  contact_position text not null,
  email text not null,
  phone text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  username text not null unique,
  class_label text,
  -- Accounts start with a temporary password that must be changed on first login.
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  constraint school_required check (role = 'super_admin' or school_id is not null)
);

create index profiles_school_idx on public.profiles (school_id, role);
create index school_requests_status_idx on public.school_requests (status, created_at desc);

alter table public.schools enable row level security;
alter table public.school_requests enable row level security;
alter table public.profiles enable row level security;

-- Signed-in users may read their own profile and their own school; nothing else is readable or
-- writable from the browser.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "read own school" on public.schools
  for select to authenticated
  using (id = (select school_id from public.profiles where id = auth.uid()));
