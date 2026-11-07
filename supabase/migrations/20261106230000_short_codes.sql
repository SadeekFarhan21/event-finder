-- Short, stable share codes: links read e.html?s=3f9a1c2e instead of the long slug id.
-- Derived from the id, so a spot's code never changes and needs no bookkeeping. Not unique-
-- constrained (a clash would block an insert); with 8 hex digits and a few hundred live rows a
-- clash is vanishingly rare, and the page falls back to the long id link the app also understands.
alter table public.events add column if not exists short text generated always as (left(md5(id), 8)) stored;
create index if not exists events_short_idx on public.events (short);

create or replace view public.upcoming_events with (security_invoker = on) as
  select * from public.events
  where start is null or category = 'deal' or start > now() - interval '6 hours';
