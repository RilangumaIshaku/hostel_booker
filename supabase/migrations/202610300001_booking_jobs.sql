-- FUTMINNA Hostel Booker: per-student portal connection and scheduled jobs.
-- Apply only after creating a Supabase project. The service role is server-only.

create table if not exists public.portal_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_username text not null,
  encrypted_password text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_connections enable row level security;
revoke all on public.portal_connections from anon, authenticated;
grant all on public.portal_connections to service_role;

create table if not exists public.booking_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session text not null default '2026/2027',
  hostel_preference text not null default 'Needs Assessment Hostel',
  room_preferences text[] not null default array['Room of 2', 'Room of 4'],
  starts_at timestamptz not null,
  status text not null default 'armed' check (status in (
    'armed', 'running', 'needs_attention', 'booking_pending',
    'confirmed', 'unconfirmed', 'cancelled', 'failed'
  )),
  worker_id text,
  claimed_at timestamptz,
  last_checked_at timestamptz,
  result_code text,
  result_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(room_preferences) between 1 and 2)
);

create index if not exists booking_jobs_due_idx
  on public.booking_jobs (starts_at, created_at)
  where status = 'armed';

alter table public.booking_jobs enable row level security;
grant select on public.booking_jobs to authenticated;
grant all on public.booking_jobs to service_role;
create policy "Students can read their own booking jobs"
  on public.booking_jobs for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.booking_jobs from anon, authenticated;

create or replace function public.claim_due_booking_job(p_worker_id text)
returns setof public.booking_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.booking_jobs;
begin
  select * into claimed
  from public.booking_jobs
  where status = 'armed' and starts_at <= now()
  order by starts_at, created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.booking_jobs
  set status = 'running', worker_id = p_worker_id,
      claimed_at = now(), updated_at = now()
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_due_booking_job(text) from public, anon, authenticated;
grant execute on function public.claim_due_booking_job(text) to service_role;
