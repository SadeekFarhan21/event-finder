// One-time: copy the local dev data (spots, rooms, geocode cache) into Supabase.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env (never ship that key in the app).
//   npm run push
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isPartner } from "../supabase/functions/_shared/partners.ts";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const read = (f: string) => (existsSync(new URL(f, import.meta.url)) ? JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")) : {});

const events = Object.entries(read("./data/events.json") as Record<string, any[]>).flatMap(([city, list]) =>
  list.map((e) => ({
    id: e.id, city, title: e.title, venue: e.venue, address: e.address, start: e.start, category: e.category,
    price: e.price, deal: e.deal, description: e.description ?? "", url: e.url, lat: e.lat, lng: e.lng,
    confidence: e.confidence, partner: isPartner(e.venue), source: e.source ?? "exa", discovered_at: e.discoveredAt,
  })),
);
const rooms = Object.entries(read("./data/leads.json") as Record<string, any[]>).flatMap(([city, list]) =>
  list.map((l) => ({
    id: l.id, city, venue: l.venue, area: l.area, address: l.address, kind: l.kind, capacity: l.capacity, fit: l.fit,
    quiet_night: l.quietNight, contact: l.contact, url: l.url, confidence: l.confidence, found_at: l.foundAt,
  })),
);
const geocache = Object.entries(read("./data/geocache.json") as Record<string, { lat: number; lng: number } | null>)
  .map(([key, pt]) => ({ key, lat: pt?.lat ?? null, lng: pt?.lng ?? null }));

// One row per primary key (local files can repeat an id across merged runs; last wins).
const byKey = <T,>(rows: T[], k: (r: T) => string) => [...new Map(rows.map((r) => [k(r), r])).values()];

for (const [table, rows] of [
  ["events", byKey(events, (r) => r.id)],
  ["rooms", byKey(rooms, (r) => r.id)],
  ["geocache", byKey(geocache, (r) => r.key)],
] as const) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500) as any[]);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length} rows`);
}
