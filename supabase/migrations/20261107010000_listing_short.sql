-- The short share code of a venue's own live listing, for the "Share your night" link on its
-- manage page. Keyed by the private manage token; null until the listing is on the map.
create or replace function public.listing_short(p_token uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select e.short from public.submissions s join public.events e on e.id = s.event_id
  where s.manage_token = p_token;
$$;

revoke all on function public.listing_short(uuid) from public;
grant execute on function public.listing_short(uuid) to anon, authenticated;
