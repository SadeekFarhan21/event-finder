-- Photos from each spot's own event page (og:image), filled in a few per tick. A spot is tried
-- once (photo_checked_at), so pages without a preview image aren't refetched every 5 minutes.
alter table public.events add column photo_checked_at timestamptz;

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
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/scout';
  auth jsonb := jsonb_build_object('Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scout_key'));
begin
  -- Cheap (no search), so only when something is waiting.
  if exists (select 1 from public.submissions where status = 'approved' and published_at is null) then
    perform net.http_post(url := base, headers := auth, body := jsonb_build_object('task', 'publish'), timeout_milliseconds := 60000);
  end if;
  if exists (select 1 from public.events where image is null and photo_checked_at is null and url like 'https://%') then
    perform net.http_post(url := base, headers := auth, body := jsonb_build_object('task', 'photos'), timeout_milliseconds := 60000);
  end if;
  if local_hour between 3 and 9 then return; end if;
  perform public.invoke_scout('events', markets[i][1], (slot / 2 % 60)::int);
end;
$$;
revoke execute on function public.scout_tick() from public, anon, authenticated;
