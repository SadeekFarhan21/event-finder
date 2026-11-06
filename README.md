# Scout — a Yelo prototype

Scout is an AI event-discovery agent that fills a map with places worth taking a ride to tonight.
Prototype for Yelo ("rides to the bars, venues and events your friends are at").

```
app/     Expo (React Native) app: map, category filters, event cards, "Ride there", "I'm in"
server/  Node API + agent: Exa search (structured outputSchema) -> geocode (OSM) -> dedupe -> store
```

## How the agent works
1. Fans out 5 Exa searches per city (tonight/weekend, live music, happy hours, club nights, free/community).
2. Each search uses Exa's `outputSchema`, so Exa returns a typed `events[]` list (title, venue, address,
   start, category, price, deal, description, url) instead of raw pages.
3. Exa's per-field `grounding` becomes a confidence score + source link on each event.
4. Events are deduped (venue + title + date), geocoded with OpenStreetMap Nominatim (cached), and
   merged into `server/data/events.json`. Past events are dropped automatically.

## What's in the app
- **Map + carousel in sync:** swipe cards and the map glides to each spot; tap a pin and its card scrolls in.
- **Grouped pins** that split apart as you zoom; the active spot gets a big yellow pin with its name.
- **Filters:** All, 🌙 Tonight (tonight's events + running happy hours), and each category.
- **Spot sheet** modeled on Yelo's: venue, vibe line, time/price tags, **Ride** and **Unlock deal**.
- **✦ Scout** runs the agent for the city in the search bar (~2 min; results are saved, so the next open is instant).
- Haptics on swipe, filter, and unlock; soft header fade; light theme in Yelo's yellow/blue.

## Built around Yelo's playbook (from joinyelo.com/partner)
- **Partners first.** Yelo's partner venues (Nublu in NYC; Gold-Diggers, The Earl, Wonzimer, Rocco's
  and more in LA) are flagged, sorted to the front, and get a yellow-ringed pin. Every Scout run also
  searches what's on at that city's partner rooms (`server/partners.ts`).
- **Rooms.** Yelo's line is "we already have the audience, we need rooms." The Rooms page runs a
  second agent (`server/leads.ts`) that finds independent 50–400 cap venues with event space, why they
  fit a student/20s night, a weeknight that runs quiet, and a booking contact.
- **NYC + LA.** Tap the search bar to jump between Yelo's two markets.

## Supabase (Yelo's stack): automatic nightly scouting

```
supabase/
  migrations/…_scout.sql     events, rooms, geocache, scout_runs tables (+ RLS: public read, no public writes)
  migrations/…_nightly.sql   pg_cron: NYC + LA spots nightly, rooms weekly (via pg_net -> scout function)
  functions/scout/           Edge Function: runs either agent for one city, upserts results
  functions/_shared/         the agents themselves; also used by the local dev server
```

The app picks its backend from env: with `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
in `app/.env.local` it reads Postgres directly and the Scout button calls the function (rate-limited to one
run per city per hour). Without them it uses the local `server/`.

Deploy:
1. Create a project, then `supabase link --project-ref <ref>` and `supabase db push` (applies both migrations).
2. Secrets for the function: `supabase secrets set EXA_API_KEY=… SCOUT_KEY=<any long random string>`
3. `supabase functions deploy scout`
4. In the SQL editor: `select vault.create_secret('https://<ref>.supabase.co', 'project_url');`
   and `select vault.create_secret('<same SCOUT_KEY>', 'scout_key');` so the nightly jobs can call it.
5. Optional, start full: put `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`, run `npm run push`.
6. Point the app at it: `app/.env.local` with the URL and publishable key, restart `npx expo start`.

## Demo tip
Run Scout for your city *before* the meeting so the map opens full. Recurring deals (happy hours)
stay on the map; dated events drop off ~6 hours after they start.

## Run it
- **Android phone:** install the APK from https://scout-download.vercel.app. Expo Go can't run this app
  on Android (the map is MapLibre, a native module Expo Go doesn't include); for development use a dev
  build (`npx expo run:android` or an EAS development build).
- **iPhone / iOS Simulator:** Expo Go works (Apple Maps is built in): `cd app && npx expo start`.
- With `app/.env.local` pointing at Supabase, no local server is needed. Without it, run the local one:
   ```bash
   cd server && npm install
   cp .env.example .env   # paste your key from https://dashboard.exa.ai/api-keys
   npm start
   ```
   The app finds it automatically via your Mac's LAN IP.

Without an Exa key the local server still serves NYC demo data; the Scout button lights up once the key is set.
Try the agent from the terminal: `cd server && npm run discover -- "Austin, TX"`.

## Next steps (maps onto Yelo's other ideas)
- **Supabase:** move `events.json` into a `events` table and `discover.ts` into an Edge Function on a cron.
- **Social coordination:** "I'm in" is local today; back it with Supabase + friends graph -> "3 friends going".
- **Venue dashboard:** a review queue for agent-found events, plus venue self-serve claiming/editing.
- **Rides:** "Ride there" opens Google Maps now; swap in a Yelo ride request.
