-- Undo "I'm going": removes this device's going taps for one spot. Device ids are random per
-- install and never shown, so only the phone that tapped can take it back.
create or replace function public.ungo(p_spot_id text, p_device_id text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.spot_activity where kind = 'going' and spot_id = p_spot_id and device_id = p_device_id;
$$;
revoke execute on function public.ungo(text, text) from public;
grant execute on function public.ungo(text, text) to anon, authenticated;
