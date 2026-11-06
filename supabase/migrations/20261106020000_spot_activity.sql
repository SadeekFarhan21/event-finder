-- Engagement: what people do with a spot (opened it, tapped Ride, unlocked the deal, shared it,
-- said they're going). Powers the venue dashboard's "engagement and ride activity".
-- Keyed by venue + city as well as spot id, because spots are pruned but a venue's history
-- should outlive any one listing.

create table public.spot_activity (
  id bigint generated always as identity primary key,
  spot_id text not null check (length(spot_id) <= 200),
  venue text not null check (length(venue) <= 200),
  city text not null check (length(city) <= 100),
  kind text not null check (kind in ('view', 'ride', 'unlock', 'share', 'going')),
  device_id text not null check (length(device_id) between 8 and 64), -- random per install, no account
  created_at timestamptz not null default now()
);
create index spot_activity_venue_idx on public.spot_activity (city, venue, created_at);
create index spot_activity_spot_idx on public.spot_activity (spot_id, kind);

alter table public.spot_activity enable row level security;

-- The app may append activity; nobody reads raw rows through the API.
create policy "Anyone can log activity" on public.spot_activity
  for insert to anon, authenticated with check (created_at > now() - interval '1 minute');

-- Aggregates only: per-kind counts and unique devices for a venue over the last N days.
create or replace function public.venue_stats(p_venue text, p_city text, p_days int default 7)
returns table (kind text, total bigint, people bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.kind, count(*), count(distinct a.device_id)
  from public.spot_activity a
  where lower(a.venue) = lower(p_venue)
    and a.city = lower(p_city)
    and a.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by a.kind;
$$;
grant execute on function public.venue_stats(text, text, int) to anon, authenticated;

-- "N going" on a spot: unique devices that tapped going, for many spots at once.
create or replace function public.going_counts(p_spot_ids text[])
returns table (spot_id text, going bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.spot_id, count(distinct a.device_id)
  from public.spot_activity a
  where a.kind = 'going' and a.spot_id = any(p_spot_ids[1:500])
  group by a.spot_id;
$$;
grant execute on function public.going_counts(text[]) to anon, authenticated;
