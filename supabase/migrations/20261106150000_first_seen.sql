-- discovered_at means "first found". Re-scouting a listing must never make it look new again.
create or replace function public.keep_first_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.discovered_at is not null and new.discovered_at > old.discovered_at then
    new.discovered_at := old.discovered_at;
  end if;
  return new;
end;
$$;

drop trigger if exists events_keep_first_seen on public.events;
create trigger events_keep_first_seen before update on public.events
  for each row execute function public.keep_first_seen();
