-- Venue-supplied links are shown to reviewers and riders; only plain web links are allowed
-- (a javascript: or data: URL in an href would run script in the page).
alter table public.submissions add constraint submissions_url_scheme check (url is null or url ~* '^https?://[^\s]+$');
