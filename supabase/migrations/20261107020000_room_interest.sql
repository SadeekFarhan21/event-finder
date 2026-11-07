-- Warm leads for Yelo's partner team: for each room in a city, how many times riders opened that
-- venue's spots on Scout in the last 7 days. A room riders already seek out is an easier pitch.
create or replace function public.room_interest(p_city text)
returns table (venue text, views bigint)
language sql stable security definer set search_path = ''
as $$
  select r.venue, count(a.*)
  from public.rooms r
  join public.spot_activity a
    on a.city = lower(p_city) and a.kind = 'view' and a.created_at > now() - interval '7 days'
   and public.same_venue(a.venue, r.venue)
  where r.city = lower(p_city)
  group by r.venue
  having count(a.*) > 0;
$$;

revoke all on function public.room_interest(text) from public;
grant execute on function public.room_interest(text) to anon, authenticated;
