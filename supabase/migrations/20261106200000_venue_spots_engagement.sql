-- Which of a venue's nights draws interest: each listing on the venue page carries its own
-- spot views and ride taps from the last 7 days. The return type changes, so drop and recreate.
drop function if exists public.venue_spots(text, text);

create function public.venue_spots(p_venue text, p_city text)
returns table (venue text, title text, start timestamptz, category text, deal text, partner boolean, views bigint, rides bigint)
language sql stable security definer set search_path = ''
as $$
  select e.venue, e.title, e.start, e.category, e.deal, e.partner,
    (select count(*) from public.spot_activity a where a.spot_id = e.id and a.kind = 'view' and a.created_at > now() - interval '7 days'),
    (select count(*) from public.spot_activity a where a.spot_id = e.id and a.kind = 'ride' and a.created_at > now() - interval '7 days')
  from public.upcoming_events e
  where public.same_venue(e.venue, p_venue) and e.city = lower(p_city)
  order by e.start nulls last
  limit 50;
$$;

revoke all on function public.venue_spots(text, text) from public;
grant execute on function public.venue_spots(text, text) to anon, authenticated;
