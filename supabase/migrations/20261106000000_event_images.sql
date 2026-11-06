-- Preview photo for each spot (the source page's image, from Exa).
alter table public.events add column image text;

-- Views capture their column list when created, so rebuild it to include the new column.
create or replace view public.upcoming_events with (security_invoker = on) as
  select * from public.events
  where start is null or category = 'deal' or start > now() - interval '6 hours';
