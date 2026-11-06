// Tiny HTTP API the phone talks to. Keeps the Exa key off the device.
//   GET  /health              -> { ok, exa }
//   GET  /events?city=...     -> stored events for a city (demo data if none yet)
//   POST /discover {city}     -> runs the agent, merges results, returns them
//   GET|POST /leads           -> "Rooms": venues that could host a Yelo night
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { discover, type YeloEvent } from "../supabase/functions/_shared/discover.ts";
import { seedEvents } from "./seed.ts";
import { dedupeEvents } from "../supabase/functions/_shared/clean.ts";
import { isPartner } from "../supabase/functions/_shared/partners.ts";
import { findLeads, type Lead } from "../supabase/functions/_shared/leads.ts";
import { nodeDeps } from "./node-deps.ts";

const PORT = Number(process.env.PORT ?? 8787);
const STORE = new URL("./data/events.json", import.meta.url);
const LEADS = new URL("./data/leads.json", import.meta.url);
const loadLeads = (): Record<string, Lead[]> => (existsSync(LEADS) ? JSON.parse(readFileSync(LEADS, "utf8")) : {});

type Store = Record<string, YeloEvent[]>; // keyed by normalized city
const load = (): Store => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {});
const save = (s: Store) => writeFileSync(STORE, JSON.stringify(s, null, 1));
const cityKey = (c: string) => c.trim().toLowerCase();

// Drop events that already happened (keep undated ones and standing deals like happy hours).
const upcoming = (events: YeloEvent[]) => {
  const cutoff = Date.now() - 6 * 3600e3;
  return events
    .filter((e) => !e.start || e.category === "deal" || Date.parse(e.start) > cutoff)
    .map((e) => ({ ...e, partner: isPartner(e.venue) }));
};

let running: Promise<YeloEvent[]> | null = null;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" });
    res.end(JSON.stringify(body));
  };
  console.log(req.method, url.pathname + url.search);

  try {
    if (req.method === "OPTIONS") return send(204, null);

    if (url.pathname === "/health") return send(200, { ok: true, exa: Boolean(process.env.EXA_API_KEY) });

    if (url.pathname === "/events" && req.method === "GET") {
      const city = url.searchParams.get("city") ?? "New York, NY";
      const stored = load()[cityKey(city)];
      if (stored?.length) return send(200, { city, events: upcoming(stored), source: "store" });
      const isNyc = /new york|nyc|brooklyn|manhattan/i.test(city);
      return send(200, { city, events: isNyc ? seedEvents() : [], source: isNyc ? "demo" : "none" });
    }

    if (url.pathname === "/discover" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const city = (JSON.parse(body || "{}").city as string)?.trim() || "New York, NY";

      if (!process.env.EXA_API_KEY) {
        return send(400, { error: "EXA_API_KEY is not set on the server. Add it to server/.env and restart." });
      }
      if (running) return send(409, { error: "A discovery run is already in progress." });

      const t0 = Date.now();
      running = discover(city, nodeDeps((m) => console.log("  " + m)));
      const found = await running.finally(() => (running = null));

      // Merge into what we already have for this city (new results win on id clash).
      const store = load();
      const before = store[cityKey(city)] ?? [];
      store[cityKey(city)] = upcoming(dedupeEvents([...before, ...found]));
      const added = store[cityKey(city)].length - upcoming(before).length;
      save(store);

      return send(200, { city, events: store[cityKey(city)], added: Math.max(0, added), ms: Date.now() - t0, source: "exa" });
    }

    // Rooms: venue leads for Yelo's partner team.
    if (url.pathname === "/leads" && req.method === "GET") {
      const city = url.searchParams.get("city") ?? "New York, NY";
      return send(200, { city, leads: loadLeads()[cityKey(city)] ?? [] });
    }
    if (url.pathname === "/leads" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const city = (JSON.parse(body || "{}").city as string)?.trim() || "New York, NY";
      if (!process.env.EXA_API_KEY) return send(400, { error: "EXA_API_KEY is not set on the server." });
      const t0 = Date.now();
      const found = await findLeads(city, nodeDeps((m) => console.log("  " + m)));
      const all = loadLeads();
      const byId = new Map((all[cityKey(city)] ?? []).map((l) => [l.id, l]));
      for (const l of found) byId.set(l.id, l);
      all[cityKey(city)] = [...byId.values()];
      writeFileSync(LEADS, JSON.stringify(all, null, 1));
      return send(200, { city, leads: all[cityKey(city)], added: found.length, ms: Date.now() - t0 });
    }

    send(404, { error: "not found" });
  } catch (err) {
    console.error(err);
    send(500, { error: String(err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces()).flat().find((i) => i?.family === "IPv4" && !i.internal)?.address;
  console.log(`yelo-discover API on http://localhost:${PORT}  (phone: http://${lan}:${PORT})`);
  console.log(process.env.EXA_API_KEY ? "Exa key loaded." : "No EXA_API_KEY: serving demo data only.");
});
