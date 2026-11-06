-- A crew keeps its own copy of the spot. The scout re-runs every 5 minutes and may merge
-- duplicates or prune past nights, which changes or removes event ids; a crew must outlive that.
alter table public.crews drop constraint crews_spot_id_fkey;
alter table public.crews
  add column venue text not null default '' check (length(venue) <= 120),
  add column title text not null default '' check (length(title) <= 300),
  add column address text not null default '' check (length(address) <= 300),
  add column lat double precision not null default 0 check (lat between -90 and 90),
  add column lng double precision not null default 0 check (lng between -180 and 180),
  add column start timestamptz;

drop function public.start_crew(text, timestamptz, text, text);

create function public.start_crew(p_spot_id text, p_leave_at timestamptz, p_device_id text, p_name text,
  p_venue text, p_title text, p_address text, p_lat double precision, p_lng double precision, p_start timestamptz)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c text := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16);
begin
  if p_leave_at < now() - interval '1 hour' or p_leave_at > now() + interval '8 days' then
    raise exception 'Pick a leave time in the next few days';
  end if;
  if (select count(*) from public.crew_members m where m.device_id = p_device_id and m.joined_at > now() - interval '1 hour') >= 10 then
    raise exception 'That''s a lot of crews. Try again in a bit.';
  end if;
  insert into public.crews (code, spot_id, leave_at, venue, title, address, lat, lng, start)
    values (c, p_spot_id, p_leave_at, p_venue, p_title, p_address, p_lat, p_lng, p_start);
  insert into public.crew_members (crew_code, device_id, name) values (c, p_device_id, trim(p_name));
  return c;
end;
$$;
revoke execute on function public.start_crew(text, timestamptz, text, text, text, text, text, double precision, double precision, timestamptz) from public;
grant execute on function public.start_crew(text, timestamptz, text, text, text, text, text, double precision, double precision, timestamptz) to anon, authenticated;

create or replace function public.get_crews(p_codes text[], p_device_id text default null)
returns table (code text, spot_id text, leave_at timestamptz, venue text, title text, address text, lat double precision,
  lng double precision, start timestamptz, members jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.spot_id, c.leave_at, c.venue, c.title, c.address, c.lat, c.lng, c.start,
    coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'status', m.status, 'me', m.device_id = p_device_id) order by m.joined_at)
      from public.crew_members m where m.crew_code = c.code), '[]'::jsonb)
  from public.crews c
  where c.code = any(p_codes[1:30]);
$$;
