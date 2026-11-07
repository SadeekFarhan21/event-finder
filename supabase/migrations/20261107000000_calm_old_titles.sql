-- Two titles stored before the agent calmed shouting flyer text (clean.ts calmCaps). The app
-- calms them on screen; the site shows stored text, so fix the rows. initcap matches calmCaps here
-- (no acronyms or small words in either title).
update public.events set title = initcap(title)
where title in ('NU NOIZE', 'SWEATER FUNK RARE BOOGIE DANCE PARTY!');
