-- Crew codes are share-link secrets, so make them unguessable: 16 hex chars (64 bits) instead
-- of 8 (32 bits, enumerable through get_crews). Existing 8-char codes keep working.
alter table public.crews drop constraint crews_code_check;
alter table public.crews add constraint crews_code_check check (code ~ '^[a-f0-9]{8}$|^[a-f0-9]{16}$');

create or replace function public.start_crew(p_spot_id text, p_leave_at timestamptz, p_device_id text, p_name text)
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
    raise exception 'Leave time must be soon';
  end if;
  if (select count(*) from public.crew_members m where m.device_id = p_device_id and m.joined_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many crews';
  end if;
  insert into public.crews (code, spot_id, leave_at) values (c, p_spot_id, p_leave_at);
  insert into public.crew_members (crew_code, device_id, name) values (c, p_device_id, trim(p_name));
  return c;
end;
$$;

-- Fewer codes per call, so a batch can't be used to sweep guesses.
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
  where c.code = any(p_codes[1:30]);
$$;
