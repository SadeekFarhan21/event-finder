// Where spots and rooms come from: Supabase when configured (Yelo's stack, see supabase.ts),
// otherwise the local dev server in /server.
import Constants from "expo-constants";
import type { Lead, Spot } from "../lib/types";
import { sbEvents, sbRooms, sbRun, supabase } from "./supabase";

// In dev, the phone reaches the local server on the machine that serves the JS bundle.
// hostUri looks like "192.168.1.20:8081"; swap the port for the server's.
const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:8787`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
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
  if (!supabase) return post<{ events: Spot[]; added: number }>("/discover", { city }).then((r) => ({ spots: r.events, added: r.added }));
  const run = await sbRun("events", city);
  return { spots: await sbEvents(city), added: run.added };
};

export const getLeads = async (city: string) =>
  supabase ? sbRooms(city) : (await call<{ leads: Lead[] }>(`/leads${q(city)}`)).leads;

export const runLeads = async (city: string) => {
  if (!supabase) return (await post<{ leads: Lead[] }>("/leads", { city })).leads;
  await sbRun("rooms", city);
  return sbRooms(city);
};
