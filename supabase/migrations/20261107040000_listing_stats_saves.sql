-- A venue's own listing also counts riders who saved it. Return type changes: drop and recreate.
drop function if exists public.listing_stats(uuid);

create function public.listing_stats(p_token uuid)
returns table (views bigint, people bigint, going bigint, rides bigint, unlocks bigint, shares bigint, crews bigint, saves bigint)
language sql stable security definer set search_path = ''
as $$
  with s as (select event_id from public.submissions where manage_token = p_token and event_id is not null)
  select
    count(*) filter (where a.kind = 'view'),
    count(distinct a.device_id),
    count(*) filter (where a.kind = 'going'),
    count(*) filter (where a.kind = 'ride'),
    count(*) filter (where a.kind = 'unlock'),
    count(*) filter (where a.kind = 'share'),
    (select count(*) from public.crews c where c.spot_id = (select event_id from s)),
    count(distinct a.device_id) filter (where a.kind = 'save')
  from public.spot_activity a
  where a.spot_id = (select event_id from s);
$$;

revoke all on function public.listing_stats(uuid) from public;
grant execute on function public.listing_stats(uuid) to anon, authenticated;
