-- The hostel a student chose, and the gender that locks the choice.
--
-- Every hostel in the 2026/2027 catalogue belongs to one gender (see
-- lib/hostels.mjs). The gender is stored beside the hostel id so a job can be
-- rejected even if the catalogue changes later.

alter table public.booking_jobs add column if not exists gender text;
alter table public.booking_jobs add column if not exists hostel_id text;

-- Hostels without a room-type split (for example Bosso Boys Hostel) book any
-- bed space in that hostel, so an empty preference list is now valid.
alter table public.booking_jobs drop constraint if exists booking_jobs_check;
alter table public.booking_jobs drop constraint if exists booking_jobs_room_preferences_check;
alter table public.booking_jobs add constraint booking_jobs_room_preferences_check
  check (cardinality(room_preferences) between 0 and 2);

alter table public.booking_jobs drop constraint if exists booking_jobs_gender_check;
alter table public.booking_jobs add constraint booking_jobs_gender_check
  check (gender is null or gender in ('male', 'female'));

create table if not exists public.student_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  hostel_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_preferences enable row level security;
revoke all on public.student_preferences from anon, authenticated;
grant select on public.student_preferences to authenticated;
grant all on public.student_preferences to service_role;

drop policy if exists "Students can read their own hostel choice" on public.student_preferences;
create policy "Students can read their own hostel choice"
  on public.student_preferences for select to authenticated using (auth.uid() = user_id);

-- Anyone reading the job list can see which hostel was chosen, never another
-- student's portal credentials.
alter table public.booking_jobs add column if not exists preference_recorded_at timestamptz;
