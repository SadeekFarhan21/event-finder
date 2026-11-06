-- One venue, several spellings ("Nublu" and "Nublu 151"): stats, spots and ride activity match a
-- venue name if one is the other plus whole words, within the same city. Exact matches still win
-- because they're included too.
create or replace function public.same_venue(a text, b text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(trim(a)) = lower(trim(b))
      or (length(trim(b)) >= 4 and lower(trim(a)) like lower(trim(b)) || ' %')
      or (length(trim(a)) >= 4 and lower(trim(b)) like lower(trim(a)) || ' %');
$$;

create or replace function public.venue_stats(p_venue text, p_city text, p_days int default 7)
returns table (kind text, total bigint, people bigint)
language sql stable security definer set search_path = ''
as $$
  select a.kind, count(*), count(distinct a.device_id)
  from public.spot_activity a
  where public.same_venue(a.venue, p_venue)
    and a.city = lower(p_city)
    and a.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by a.kind;
$$;

create or replace function public.venue_spots(p_venue text, p_city text)
returns table (title text, start timestamptz, category text, deal text, partner boolean)
language sql stable security definer set search_path = ''
as $$
  select e.title, e.start, e.category, e.deal, e.partner
  from public.upcoming_events e
  where public.same_venue(e.venue, p_venue) and e.city = lower(p_city)
  order by e.start nulls last
  limit 50;
$$;

create or replace function public.venue_movement(p_venue text, p_city text, p_days int default 7)
returns table (crews bigint, people bigint, on_way bigint)
language sql stable security definer set search_path = ''
as $$
  select count(distinct c.code), count(m.*) filter (where m.status <> 'out'), count(m.*) filter (where m.status = 'on_way')
  from public.crews c
  join public.crew_members m on m.crew_code = c.code
  where public.same_venue(c.venue, p_venue)
    and c.spot_id like regexp_replace(lower(p_city), '[^a-z0-9]+', '-', 'g') || '-%'
    and c.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90));
$$;

-- "Did you mean": the closest venue names in a city (prefix either way, then trigram-free fuzzy by
-- shared first word), for a lookup that found nothing.
create or replace function public.venue_suggest(p_venue text, p_city text)
returns table (venue text)
language sql stable security definer set search_path = ''
as $$
  select distinct e.venue from public.upcoming_events e
  where e.city = lower(p_city) and length(trim(p_venue)) >= 3
    and (lower(e.venue) like lower(trim(p_venue)) || '%'
         or lower(e.venue) like '%' || lower(trim(p_venue)) || '%'
         or split_part(lower(e.venue), ' ', 1) = split_part(lower(trim(p_venue)), ' ', 1)
         or left(lower(e.venue), 4) = left(lower(trim(p_venue)), 4))
  limit 3;
$$;
grant execute on function public.venue_suggest(text, text) to anon, authenticated;
