-- One room, one name on the map: listings scraped as "Nublu 151" now read "Nublu", Yelo's spelling.
-- New runs do this in the agent (partners.ts partnerName); this fixes rows already stored.
update public.events set venue = 'Nublu' where venue ~* '^nublu\s*\d+$';
