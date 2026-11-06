-- Crews: "who's heading out with me". Someone starts a crew for a spot with a leave time and
-- shares its code; friends join from the app or the web page. No accounts: a device id (kept on
-- the device, never shown to others) identifies a member, a display name is what friends see.
-- Tables are closed to the public; everything goes through the functions below, and a crew is
-- only reachable by its code (unguessable, like a share link).

create table public.crews (
  code text primary key check (code ~ '^[a-z0-9]{8}$'),
  spot_id text not null references public.events (id) on delete cascade,
  leave_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_code text not null references public.crews (code) on delete cascade,
  device_id text not null check (length(device_id) between 16 and 64),
  name text not null check (length(name) between 1 and 30),
  status text not null default 'in' check (status in ('in', 'on_way', 'out')),
  joined_at timestamptz not null default now(),
  primary key (crew_code, device_id)
);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
-- No policies: anon/authenticated can't touch the tables directly.

-- Start a crew; the creator is its first member. Returns the code.
create or replace function public.start_crew(p_spot_id text, p_leave_at timestamptz, p_device_id text, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c text := substr(md5(gen_random_uuid()::text), 1, 8);
begin
  if p_leave_at < now() - interval '1 hour' or p_leave_at > now() + interval '8 days' then
    raise exception 'Leave time must be soon';
  end if;
  -- One device can't spam crews.
  if (select count(*) from public.crew_members m where m.device_id = p_device_id and m.joined_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many crews';
  end if;
  insert into public.crews (code, spot_id, leave_at) values (c, p_spot_id, p_leave_at);
  insert into public.crew_members (crew_code, device_id, name) values (c, p_device_id, trim(p_name));
  return c;
end;
$$;

-- Join (or rename/rejoin) a crew.
create or replace function public.join_crew(p_code text, p_device_id text, p_name text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.crews where code = p_code) then raise exception 'Crew not found'; end if;
  if (select count(*) from public.crew_members where crew_code = p_code) >= 20 then raise exception 'Crew is full'; end if;
  insert into public.crew_members (crew_code, device_id, name) values (p_code, p_device_id, trim(p_name))
  on conflict (crew_code, device_id) do update set name = excluded.name, status = 'in';
end;
$$;

-- Update my status: in (coming), on_way (in the ride), out (can't make it).
create or replace function public.set_crew_status(p_code text, p_device_id text, p_status text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.crew_members set status = p_status where crew_code = p_code and device_id = p_device_id;
$$;

-- What a member (or anyone with the link) sees: the spot, leave time, and names. Never device ids,
-- except a flag for "this one is you".
create or replace function public.get_crews(p_codes text[], p_device_id text default null)
returns table (code text, spot_id text, leave_at timestamptz, venue text, title text, address text, lat double precision,
  lng double precision, start timestamptz, members jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.spot_id, c.leave_at, e.venue, e.title, e.address, e.lat, e.lng, e.start,
    coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'status', m.status, 'me', m.device_id = p_device_id) order by m.joined_at)
      from public.crew_members m where m.crew_code = c.code), '[]'::jsonb)
  from public.crews c join public.events e on e.id = c.spot_id
  where c.code = any(p_codes[1:50]);
$$;

revoke execute on function public.start_crew(text, timestamptz, text, text), public.join_crew(text, text, text),
  public.set_crew_status(text, text, text), public.get_crews(text[], text) from public;
grant execute on function public.start_crew(text, timestamptz, text, text), public.join_crew(text, text, text),
  public.set_crew_status(text, text, text), public.get_crews(text[], text) to anon, authenticated;
