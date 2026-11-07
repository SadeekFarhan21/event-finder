-- "Saved" becomes a signal venues can see: a rider saving a spot logs a 'save' (anonymous device id,
-- like views), and unsaving removes that device's save so the count stays honest.
alter table public.spot_activity drop constraint spot_activity_kind_check;
alter table public.spot_activity add constraint spot_activity_kind_check
  check (kind in ('view', 'ride', 'unlock', 'share', 'going', 'save'));

create or replace function public.unsave(p_spot_id text, p_device_id text)
returns void
language sql volatile security definer set search_path = ''
as $$
  delete from public.spot_activity where kind = 'save' and spot_id = p_spot_id and device_id = p_device_id;
$$;
revoke execute on function public.unsave(text, text) from public;
grant execute on function public.unsave(text, text) to anon, authenticated;
