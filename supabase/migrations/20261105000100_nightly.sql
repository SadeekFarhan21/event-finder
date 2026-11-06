-- Nightly Scout runs for Yelo's two markets, via pg_cron + pg_net.
-- Before applying, store two secrets in Vault (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role key or a secret key>', 'scout_key');
-- The scout function checks this key, so only the schedule (and you) can trigger runs.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_scout(task text, city text)
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
    body := jsonb_build_object('task', task, 'city', city),
    timeout_milliseconds := 150000
  );
$$;
revoke execute on function public.invoke_scout(text, text) from public, anon, authenticated;

-- Spots refresh nightly (times are UTC: 14:00 UTC = 9am ET / 6am PT, before people plan the night).
-- Runs are spaced out so they never share Exa's rate limit or the 150s function budget.
select cron.schedule('scout-nyc', '0 14 * * *', $$ select public.invoke_scout('events', 'New York, NY') $$);
select cron.schedule('scout-la',  '15 14 * * *', $$ select public.invoke_scout('events', 'Los Angeles, CA') $$);

-- Rooms change slowly: refresh weekly on Mondays.
select cron.schedule('rooms-nyc', '30 14 * * 1', $$ select public.invoke_scout('rooms', 'New York, NY') $$);
select cron.schedule('rooms-la',  '45 14 * * 1', $$ select public.invoke_scout('rooms', 'Los Angeles, CA') $$);
