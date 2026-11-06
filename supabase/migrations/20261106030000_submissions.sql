-- Venue self-serve: venues and producers submit an event or deal for Yelo's map. Submissions
-- land as 'pending' and go live only after review, so the public form can't put spam on the map.

create table public.submissions (
  id bigint generated always as identity primary key,
  city text not null check (length(city) between 2 and 100),
  venue text not null check (length(venue) between 2 and 120),
  address text not null check (length(address) between 5 and 200),
  title text not null check (length(title) between 2 and 140),
  start timestamptz, -- null for a standing deal (e.g. a weekday happy hour)
  category text not null check (category in ('nightlife','music','food_drink','arts','sports','community','deal')),
  deal text check (length(deal) <= 200),
  description text check (length(description) <= 400),
  url text check (length(url) <= 300),
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index submissions_status_idx on public.submissions (status, created_at);

alter table public.submissions enable row level security;

-- Public can submit (always as pending); nobody can read submissions (they hold emails).
create policy "Anyone can submit for review" on public.submissions
  for insert to anon, authenticated with check (status = 'pending' and created_at > now() - interval '1 minute');

-- What a venue page shows: its spots currently on the map (names and times only).
create or replace function public.venue_spots(p_venue text, p_city text)
returns table (title text, start timestamptz, category text, deal text, partner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.title, e.start, e.category, e.deal, e.partner
  from public.upcoming_events e
  where lower(e.venue) = lower(p_venue) and e.city = lower(p_city)
  order by e.start nulls last
  limit 50;
$$;
grant execute on function public.venue_spots(text, text) to anon, authenticated;
