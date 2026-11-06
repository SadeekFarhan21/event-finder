-- "N going" counts everyone heading to a spot: people who tapped "I'm going" plus crew members
-- who haven't bowed out. Unique per device, so someone who did both counts once.
create or replace function public.going_counts(p_spot_ids text[])
returns table (spot_id text, going bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select spot_id, count(distinct device_id)
  from (
    select a.spot_id, a.device_id from public.spot_activity a
    where a.kind = 'going' and a.spot_id = any(p_spot_ids[1:500])
    union all
    select c.spot_id, m.device_id from public.crews c join public.crew_members m on m.crew_code = c.code
    where m.status <> 'out' and c.spot_id = any(p_spot_ids[1:500]) and c.leave_at > now() - interval '12 hours'
  ) people
  group by spot_id;
$$;
