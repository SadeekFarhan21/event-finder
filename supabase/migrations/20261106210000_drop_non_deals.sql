-- Scraped "deals" that offer nothing ("Sushi reservations on Resy", "Themed holiday cocktails").
-- Same rule as isRealDeal in _shared/clean.ts: a price, discount, free entry, happy hour and so on,
-- in the deal text or the title. New runs apply it in the agent; this clears rows already stored.
update public.events
set deal = null
where deal is not null
  and (deal || ' ' || title) !~* '(\$|%|\yfree\y|\yoff\y|happy hour|\yhalf\y|discount|complimentary|\ycomp\y|2[- ]?for[- ]?1|two[- ]for[- ]one|\ybogo\y|buy one|no cover|reduced|special|bottomless|unlimited|open bar|\yhour\y|aperitivo)';
