// Where spots and rooms come from: Supabase when configured (Yelo's stack, see supabase.ts),
// otherwise the local dev server in /server.
import type { Lead, Spot } from "../lib/types";
import { config } from "../config";
import { fetchWithTimeout } from "../lib/net";
import { sbEvents, sbRooms, sbRun, supabase } from "./supabase";

const fetchT = fetchWithTimeout(config.requestTimeoutMs);

// Local dev server only (never in release builds; see config.ts).
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!config.devApiUrl) throw new Error("Scout isn't connected to its server.");
  const res = await fetchT(`${config.devApiUrl}${path}`, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const q = (city: string) => `?city=${encodeURIComponent(city)}`;

// Whether the Scout button can run the agent (the local server reports if it has an Exa key).
export const canScout = async () =>
  supabase ? true : (await call<{ exa: boolean }>("/health")).exa;

export const getSpots = async (city: string) =>
  supabase ? sbEvents(city) : (await call<{ events: Spot[] }>(`/events${q(city)}`)).events;

export const runScout = async (city: string) => {
  if (!supabase) return post<{ events: Spot[]; added: number }>("/discover", { city }).then((r) => ({ spots: r.events, added: r.added, pending: false }));
  const run = await sbRun("events", city);
  return { spots: await sbEvents(city), added: run.added, pending: run.pending };
};

export const getLeads = async (city: string) =>
  supabase ? sbRooms(city) : (await call<{ leads: Lead[] }>(`/leads${q(city)}`)).leads;

export const runLeads = async (city: string) => {
  if (!supabase) return (await post<{ leads: Lead[] }>("/leads", { city })).leads;
  await sbRun("rooms", city);
  return sbRooms(city);
};
