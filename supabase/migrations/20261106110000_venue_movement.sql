-- Ride activity for venues: crews heading to them. Counts only (no names), over the last N days.
-- Crews keep a copy of the venue name; the spot id starts with the city slug ("new-york-ny-...").
create or replace function public.venue_movement(p_venue text, p_city text, p_days int default 7)
returns table (crews bigint, people bigint, on_way bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct c.code), count(m.*) filter (where m.status <> 'out'), count(m.*) filter (where m.status = 'on_way')
  from public.crews c
  join public.crew_members m on m.crew_code = c.code
  where lower(c.venue) = lower(p_venue)
    and c.spot_id like regexp_replace(lower(p_city), '[^a-z0-9]+', '-', 'g') || '-%'
    and c.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90));
$$;
grant execute on function public.venue_movement(text, text, int) to anon, authenticated;
