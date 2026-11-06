-- Rolling scout: every 5 minutes, run ONE search for ONE city, cycling through cities and
-- topics (tonight, live music, deals, clubs, community, partner rooms). The map stays fresh all
-- day for about the cost of a few full runs, and each tick finishes well inside the function limit.

-- Which single search a run did; null = a full run (nightly cron or the app's Scout button).
alter table public.scout_runs add column focus smallint;

create or replace function public.invoke_scout(task text, city text, focus int)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scout_key')
    ),
    body := jsonb_build_object('task', task, 'city', city, 'focus', focus),
    timeout_milliseconds := 150000
  );
$$;
revoke execute on function public.invoke_scout(text, text, int) from public, anon, authenticated;

-- One tick: slot n alternates cities; each city steps to its next topic every other tick
-- (the function wraps the index to however many searches that city has). Skips 3-10am in the
-- city's own time zone, when nobody is planning a night and listings barely change.
create or replace function public.scout_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  markets constant text[][] := array[['New York, NY', 'America/New_York'], ['Los Angeles, CA', 'America/Los_Angeles']];
  slot bigint := floor(extract(epoch from now()) / 300);
  i int := (slot % 2)::int + 1;
  local_hour int := extract(hour from now() at time zone markets[i][2]);
begin
  if local_hour between 3 and 9 then return; end if;
  perform public.invoke_scout('events', markets[i][1], (slot / 2 % 60)::int);
end;
$$;
revoke execute on function public.scout_tick() from public, anon, authenticated;

select cron.schedule('scout-rolling', '*/5 * * * *', $$ select public.scout_tick() $$);
