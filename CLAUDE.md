# Scout (a Yelo prototype)

Built for Farhan's conversation with Alekos at Yelo (joinyelo.com), Nov 2026. Alekos asked for one of:
a venue/event dashboard, social coordination, or an **AI event discovery agent**. Scout is the third,
built around Yelo's actual business (read joinyelo.com/partner): Yelo partners with venues, builds a
night on a quiet weeknight, and fills the room with its riders.

## What's here
- `app/` Expo SDK 58 React Native app. Map of spots (cluster pins, filters incl. Tonight), synced card
  carousel, detail sheet (Ride with fare estimate, Unlock deal), Rooms page (venue leads). No Expo Router;
  single screen in `App.tsx` + `src/`.
- `supabase/functions/_shared/` the agents, runtime-agnostic (deps injected via `deps.ts`):
  `discover.ts` (Exa deep search with outputSchema -> geocode via Nominatim -> dedupe),
  `leads.ts` (Rooms), `clean.ts` (venue/title cleanup, cross-run dedupe), `partners.ts` (Yelo partners).
- `supabase/functions/scout/` Edge Function (POST {task: events|rooms, city}). Replies 202, works in
  background, 135s budget (free plan wall clock is 150s). Auth: SCOUT_KEY, else 1 run/city/hour.
- `supabase/migrations/` schema (events, rooms, geocache, scout_runs; RLS public read only) + pg_cron
  (NYC/LA spots daily 14:00/14:15 UTC, rooms Mondays).
- `server/` optional local Node dev server using the same `_shared` agents (file-based geocache).

## Live infrastructure
- Supabase project `ihxsdwpersowxxtgqcws` (account/org "fsadeek"). Function secrets: EXA_API_KEY,
  SCOUT_KEY. Vault: project_url, scout_key.
- Expo/EAS project `@fsadeek/scout` (projectId in app.json). EAS env (preview, production) holds
  EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. `eas.json` preview = Android APK.
- Locally, `app/.env.local` (Supabase URL + publishable key) and `server/.env` (Exa key, Supabase
  service key) are git-ignored. Never commit keys.

## Design rules (the user asked for it to not look "vibecoded")
- `app/src/theme.ts` is the system: Instrument Serif for venue names/headlines, Inter for UI,
  cream background, Yelo yellow #FFE600 only for primary actions and the selected spot, blue #1F4FFF
  only for deals. Ionicons outline icons. No emoji anywhere.
- Copy should be plain and specific. Fares are labeled as estimates.

## Checks before calling something done
- `cd app && npx tsc --noEmit` and `npx expo-doctor`.
- Edge function: `npx -y deno@latest check --config supabase/functions/scout/deno.json supabase/functions/scout/index.ts`.
- `_shared/` must not import Node-only modules (it also runs on Deno).
- Never edit applied migrations; add a new one. Deploy functions with
  `supabase functions deploy scout --use-api`.
