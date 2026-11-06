-- Venues manage their own listings without an account: submitting returns a private manage
-- token (a secret link, like a crew code). With it a venue can check status, edit, or withdraw.
-- Editing a live listing sends it back to review and takes it off the map until re-approved.

alter table public.submissions add column manage_token uuid not null default gen_random_uuid();
create unique index submissions_manage_token_idx on public.submissions (manage_token);
alter table public.submissions drop constraint submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('pending', 'approved', 'rejected', 'withdrawn'));
alter table public.submissions add column review_note text check (length(review_note) <= 300);
alter table public.submissions add column updated_at timestamptz not null default now();

-- Submit and get the manage token back (a direct insert can't return it: the table isn't readable).
create or replace function public.submit_listing(p_city text, p_venue text, p_address text, p_title text, p_category text,
  p_start timestamptz, p_deal text, p_description text, p_url text, p_contact_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare t uuid;
begin
  -- Same email can't flood the queue.
  if (select count(*) from public.submissions where contact_email = lower(trim(p_contact_email)) and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many submissions from this email. Try again later.';
  end if;
  insert into public.submissions (city, venue, address, title, category, start, deal, description, url, contact_email)
  values (lower(trim(p_city)), trim(p_venue), trim(p_address), trim(p_title), p_category, p_start,
    nullif(trim(p_deal), ''), nullif(trim(p_description), ''), nullif(trim(p_url), ''), lower(trim(p_contact_email)))
  returning manage_token into t;
  return t;
end;
$$;

-- What the venue sees on its manage page (never other venues' rows, never other emails).
create or replace function public.get_listing(p_token uuid)
returns table (venue text, city text, address text, title text, category text, start timestamptz, deal text, description text,
  url text, status text, review_note text, live boolean, created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue, s.city, s.address, s.title, s.category, s.start, s.deal, s.description, s.url, s.status, s.review_note,
    s.published_at is not null and exists (select 1 from public.events e where e.id = s.event_id), s.created_at, s.updated_at
  from public.submissions s where s.manage_token = p_token;
$$;

create or replace function public.update_listing(p_token uuid, p_address text, p_title text, p_category text,
  p_start timestamptz, p_deal text, p_description text, p_url text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare s public.submissions;
begin
  select * into s from public.submissions where manage_token = p_token;
  if not found then raise exception 'Listing not found'; end if;
  if s.status = 'withdrawn' then raise exception 'This listing was taken down. Submit a new one.'; end if;
  if s.event_id is not null then delete from public.events where id = s.event_id; end if;
  update public.submissions set address = trim(p_address), title = trim(p_title), category = p_category, start = p_start,
    deal = nullif(trim(p_deal), ''), description = nullif(trim(p_description), ''), url = nullif(trim(p_url), ''),
    status = 'pending', review_note = null, published_at = null, event_id = null, updated_at = now()
  where manage_token = p_token;
end;
$$;

create or replace function public.withdraw_listing(p_token uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare s public.submissions;
begin
  select * into s from public.submissions where manage_token = p_token;
  if not found then raise exception 'Listing not found'; end if;
  if s.event_id is not null then delete from public.events where id = s.event_id; end if;
  update public.submissions set status = 'withdrawn', published_at = null, event_id = null, updated_at = now()
  where manage_token = p_token;
end;
$$;

revoke execute on function public.submit_listing(text, text, text, text, text, timestamptz, text, text, text, text),
  public.get_listing(uuid), public.update_listing(uuid, text, text, text, timestamptz, text, text, text),
  public.withdraw_listing(uuid) from public;
grant execute on function public.submit_listing(text, text, text, text, text, timestamptz, text, text, text, text),
  public.get_listing(uuid), public.update_listing(uuid, text, text, text, timestamptz, text, text, text),
  public.withdraw_listing(uuid) to anon, authenticated;

-- The old direct-insert path is replaced by submit_listing.
drop policy "Anyone can submit for review" on public.submissions;
