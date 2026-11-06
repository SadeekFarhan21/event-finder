// Scout Edge Function: runs the discovery agent (task "events") or the rooms agent
// (task "rooms") for one city and writes the results to Postgres.
//
// POST { task: "events" | "rooms", city: "New York, NY" }
// Auth: the nightly cron sends SCOUT_KEY. Anyone else (the app's Scout button) is allowed
// one run per city per hour, so a public button can't run up the Exa bill.
// Replies 202 right away and keeps working in the background (free plan: 150s per worker).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Exa from "exa-js";
import { createClient } from "@supabase/supabase-js";
import { discover, type YeloEvent } from "../_shared/discover.ts";
import { findLeads, type Lead } from "../_shared/leads.ts";
import { dedupeEvents } from "../_shared/clean.ts";
import { isPartner } from "../_shared/partners.ts";
import { canonicalCity, cityKey } from "../_shared/cities.ts";
import type { ExaLike, GeoCache } from "../_shared/deps.ts";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const exa = new Exa(Deno.env.get("EXA_API_KEY")) as unknown as ExaLike;
const COOLDOWN_MS = 60 * 60 * 1000;
const PUBLIC_RUNS_PER_HOUR = 6; // across all cities, so typing new city names can't run up the Exa bill
const BUDGET_MS = 135_000; // stop geocoding before the 150s wall clock

const geo: GeoCache = {
  async get(key) {
    const { data } = await db.from("geocache").select("lat,lng").eq("key", key).maybeSingle();
    if (!data) return undefined;
    return data.lat == null ? null : { lat: data.lat, lng: data.lng };
  },
  async set(key, pt) {
    await db.from("geocache").upsert({ key, lat: pt?.lat ?? null, lng: pt?.lng ?? null });
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" } });
  }
  if (req.method !== "POST") return json(405, { error: "POST { task, city }" });

  const { task = "events", city: rawCity } = await req.json().catch(() => ({}));
  const city = canonicalCity(String(rawCity ?? ""));
  if (!city || !["events", "rooms"].includes(task)) return json(400, { error: "Expected { task: 'events' | 'rooms', city }" });

  const scoutKey = Deno.env.get("SCOUT_KEY");
  const trusted = !!scoutKey && req.headers.get("Authorization") === `Bearer ${scoutKey}`;
  if (!trusted) {
    const { data: last } = await db.from("scout_runs").select("ran_at").eq("kind", task).eq("city", cityKey(city))
      .order("ran_at", { ascending: false }).limit(1).maybeSingle();
    const wait = last ? COOLDOWN_MS - (Date.now() - Date.parse(last.ran_at)) : 0;
    if (wait > 0) return json(429, { error: `Scouted recently. Try again in ${Math.ceil(wait / 60000)} min.` });
    const { count } = await db.from("scout_runs").select("id", { count: "exact", head: true })
      .gte("ran_at", new Date(Date.now() - 3600e3).toISOString());
    if ((count ?? 0) >= PUBLIC_RUNS_PER_HOUR) return json(429, { error: "Scout is busy. Try again in a little while." });
  }

  // Claim the slot now so double-taps don't start two runs.
  const { data: run } = await db.from("scout_runs").insert({ kind: task, city: cityKey(city) }).select("id").single();
  const started = Date.now();
  const work = (task === "events" ? runEvents(city, started) : runRooms(city))
    .then((r) => db.from("scout_runs").update({ ...r, ms: Date.now() - started }).eq("id", run!.id))
    .catch((err) => db.from("scout_runs").update({ error: describe(err), ms: Date.now() - started }).eq("id", run!.id));
  // Keep the worker alive after replying (Supabase's EdgeRuntime); elsewhere just finish first.
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(work);
  else await work;

  return json(202, { ok: true, runId: run!.id, message: `Scouting ${city}. Results land in a minute or two.` });
});

async function runEvents(city: string, started: number) {
  const found = await discover(city, { exa, geo, log: console.log, deadline: started + BUDGET_MS });

  // Merge with what's stored: same venue + same night (or same standing deal) is one spot.
  const { data: existing } = await db.from("events").select("*").eq("city", cityKey(city));
  const before = (existing ?? []).map(fromRow);
  const merged = uniqueBy(
    dedupeEvents([...before, ...found]).map((e) => ({ ...e, city: cityKey(city), partner: isPartner(e.venue) })),
    (e) => e.id,
  );

  const { error } = await db.from("events").upsert(merged.map(toRow));
  if (error) throw error;
  // Rows that dedupe folded into a twin are gone from `merged`; remove them.
  const keep = new Set(merged.map((e) => e.id));
  const stale = before.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (stale.length) await db.from("events").delete().in("id", stale);

  return { added: Math.max(0, merged.length - before.length), total: merged.length };
}

async function runRooms(city: string) {
  const found = await findLeads(city, { exa, log: console.log });
  const { error } = await db.from("rooms").upsert(uniqueBy(found, (l) => l.id).map((l) => roomRow(l, city)));
  if (error) throw error;
  return { added: found.length, total: found.length };
}

// camelCase (agent) <-> snake_case (Postgres)
const toRow = (e: YeloEvent) => ({
  id: e.id, city: e.city, title: e.title, venue: e.venue, address: e.address, start: e.start, category: e.category,
  price: e.price, deal: e.deal, description: e.description, url: e.url, image: e.image ?? null, lat: e.lat, lng: e.lng,
  confidence: e.confidence, partner: !!e.partner, source: e.source, discovered_at: e.discoveredAt,
});
const fromRow = (r: Record<string, any>): YeloEvent => ({ ...r, discoveredAt: r.discovered_at } as YeloEvent);
const roomRow = (l: Lead, city: string) => ({
  id: l.id, city: cityKey(city), venue: l.venue, area: l.area, address: l.address, kind: l.kind, capacity: l.capacity,
  fit: l.fit, quiet_night: l.quietNight, contact: l.contact, url: l.url, confidence: l.confidence, found_at: l.foundAt,
});

// One row per primary key: Postgres rejects an upsert batch that touches the same row twice,
// and two listings can slug to the same id (same venue, title and start).
function uniqueBy<T>(rows: T[], key: (r: T) => string) {
  return [...new Map(rows.map((r) => [key(r), r])).values()];
}

// Supabase errors are plain objects; String() turns them into "[object Object]".
function describe(err: unknown) {
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; details?: string; code?: string };
  return [e?.code, e?.message, e?.details].filter(Boolean).join(" · ") || JSON.stringify(err);
}
