-- Claim a booking job before its start time so the worker can sign in and
-- pre-warm the portal session while the rush is still minutes away.
-- The old claim_due_booking_job function remains valid; this one supersedes it.

create or replace function public.claim_booking_job(p_worker_id text, p_lead_seconds integer default 0)
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
  where status = 'armed'
    and starts_at <= now() + make_interval(secs => greatest(0, coalesce(p_lead_seconds, 0)))
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

revoke all on function public.claim_booking_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_booking_job(text, integer) to service_role;
