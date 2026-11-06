-- Spots never left the table: past events piled up (hidden by the view, but kept), and a
-- happy hour stayed on the map forever even after the bar dropped it. Re-discovered spots
-- get a fresh discovered_at (the merge keeps the newer copy), so age since last seen is a
-- fair signal that a listing is gone.
create or replace function public.prune_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.events
    where (start is not null and category <> 'deal' and start < now() - interval '2 days')
       or discovered_at < now() - interval '21 days'
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.prune_events() from public, anon, authenticated;

-- 13:45 UTC, just before the morning scout runs refill the map.
select cron.schedule('prune-events', '45 13 * * *', $$ select public.prune_events() $$);
