-- A friend's link opened: the spot page (site/e.html) logs one 'link' per browser per spot, with the
-- same anonymous device id crew joins use. Venues see it as "Opened from a friend's link": shares that
-- actually reached someone, i.e. word of mouth.
alter table public.spot_activity drop constraint spot_activity_kind_check;
alter table public.spot_activity add constraint spot_activity_kind_check
  check (kind in ('view', 'ride', 'unlock', 'share', 'going', 'save', 'link'));
