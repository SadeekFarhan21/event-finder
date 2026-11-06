-- Close the venue loop: an approved submission goes on the map within 5 minutes.
-- Review = `update submissions set status = 'approved' where id = ...` (or reject).
-- The rolling tick then asks the scout function to geocode and publish approved rows.

alter table public.submissions add column published_at timestamptz, add column event_id text;

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
  -- Cheap (no search), so only when something is waiting.
  if exists (select 1 from public.submissions where status = 'approved' and published_at is null) then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scout',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scout_key')),
      body := jsonb_build_object('task', 'publish'),
      timeout_milliseconds := 60000);
  end if;
  if local_hour between 3 and 9 then return; end if;
  perform public.invoke_scout('events', markets[i][1], (slot / 2 % 60)::int);
end;
$$;
revoke execute on function public.scout_tick() from public, anon, authenticated;
