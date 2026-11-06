-- The venue page matches several spellings of one venue ("Nublu" finds "Nublu 151"), so it needs the
-- name the listings actually use to label the stats. The return type changes, so drop and recreate.
drop function if exists public.venue_spots(text, text);

create function public.venue_spots(p_venue text, p_city text)
returns table (venue text, title text, start timestamptz, category text, deal text, partner boolean)
language sql stable security definer set search_path = ''
as $$
  select e.venue, e.title, e.start, e.category, e.deal, e.partner
  from public.upcoming_events e
  where public.same_venue(e.venue, p_venue) and e.city = lower(p_city)
  order by e.start nulls last
  limit 50;
$$;

revoke all on function public.venue_spots(text, text) from public;
grant execute on function public.venue_spots(text, text) to anon, authenticated;
