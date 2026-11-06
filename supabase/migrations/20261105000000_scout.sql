-- Scout: AI-discovered spots (events, deals) and rooms (venue leads) for Yelo's map.
-- Reads are public (the app uses the publishable key); only the Edge Function writes,
-- using the service role, which bypasses RLS. No insert/update policies on purpose.

create table public.events (
  id text primary key,
  city text not null,                 -- normalized, e.g. 'new york, ny'
  title text not null,
  venue text not null,
  address text not null,
  start timestamptz,                  -- null for standing deals (happy hours)
  category text not null check (category in ('nightlife','music','food_drink','arts','sports','community','deal')),
  price text,
  deal text,
  description text not null default '',
  url text,
  lat double precision not null,
  lng double precision not null,
  confidence text not null check (confidence in ('low','medium','high')),
  partner boolean not null default false,
  source text not null default 'exa',
  discovered_at timestamptz not null default now()
);
create index events_city_start_idx on public.events (city, start);

create table public.rooms (
  id text primary key,
  city text not null,
  venue text not null,
  area text not null default '',
  address text not null,
  kind text not null default '',
  capacity text,
  fit text not null default '',
  quiet_night text,
  contact text,
  url text,
  confidence text not null check (confidence in ('low','medium','high')),
  found_at timestamptz not null default now()
);
create index rooms_city_idx on public.rooms (city);

-- Nominatim results, so repeat runs skip the 1 req/sec geocoder. Private (no policies).
create table public.geocache (
  key text primary key,
  lat double precision,
  lng double precision,
  cached_at timestamptz not null default now()
);

-- One row per agent run: what ran, how long, how many spots. Useful for the nightly job.
create table public.scout_runs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('events','rooms')),
  city text not null,
  added int,
  total int,
  ms int,
  error text,
  ran_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.rooms enable row level security;
alter table public.geocache enable row level security;
alter table public.scout_runs enable row level security;

create policy "Spots are public" on public.events for select to anon, authenticated using (true);
create policy "Rooms are public" on public.rooms for select to anon, authenticated using (true);
create policy "Run history is public" on public.scout_runs for select to anon, authenticated using (true);

-- What the app shows: upcoming spots, plus standing deals regardless of date.
create view public.upcoming_events with (security_invoker = on) as
  select * from public.events
  where start is null or category = 'deal' or start > now() - interval '6 hours';
