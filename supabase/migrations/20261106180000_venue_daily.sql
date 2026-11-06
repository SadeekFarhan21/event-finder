-- Day-by-day engagement for one venue, so the venue page can show a trend and compare
-- this week with last week. Days are counted in the city's own time zone, and days with
-- no activity come back as zeros instead of missing rows.
create or replace function public.venue_daily(p_venue text, p_city text, p_days int default 14)
returns table (day date, views bigint, rides bigint, unlocks bigint)
language sql stable security definer set search_path = ''
as $$
  with tz as (
    select case lower(p_city) when 'los angeles, ca' then 'America/Los_Angeles' else 'America/New_York' end as name
  ), days as (
    select generate_series(
      (now() at time zone (select name from tz))::date - (least(greatest(p_days, 1), 90) - 1),
      (now() at time zone (select name from tz))::date,
      interval '1 day')::date as day
  )
  select d.day,
    count(a.*) filter (where a.kind = 'view'),
    count(a.*) filter (where a.kind = 'ride'),
    count(a.*) filter (where a.kind = 'unlock')
  from days d
  left join public.spot_activity a
    on (a.created_at at time zone (select name from tz))::date = d.day
   and public.same_venue(a.venue, p_venue)
   and a.city = lower(p_city)
  group by d.day
  order by d.day;
$$;

revoke all on function public.venue_daily(text, text, int) from public;
grant execute on function public.venue_daily(text, text, int) to anon, authenticated;
