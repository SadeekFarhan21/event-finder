import Constants from "expo-constants";
import { sbEvents, sbRooms, sbRun, supabase } from "./supabase";

export type Category = "nightlife" | "music" | "food_drink" | "arts" | "sports" | "community" | "deal";

export type YeloEvent = {
  id: string;
  title: string;
  venue: string;
  address: string;
  start: string | null;
  category: Category;
  price: string | null;
  deal: string | null;
  description: string;
  url: string | null;
  lat: number;
  lng: number;
  confidence: "low" | "medium" | "high";
  source: "exa" | "demo";
  partner?: boolean; // one of Yelo's venue partners
};

// In dev, the phone reaches the API on the same machine that serves the JS bundle.
// hostUri looks like "192.168.1.20:8081"; swap the port for the API's.
// Override with EXPO_PUBLIC_API_URL (e.g. a deployed Supabase function) when needed.
const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:8787`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

// Which backend: Supabase when configured (Yelo's stack), else the local dev server.
export const BACKEND = supabase ? "supabase" : "local";

export const getHealth = () =>
  supabase ? Promise.resolve({ ok: true, exa: true }) : call<{ ok: boolean; exa: boolean }>("/health");

export const getEvents = async (city: string) =>
  supabase
    ? { events: await sbEvents(city), source: "supabase" }
    : call<{ events: YeloEvent[]; source: string }>(`/events?city=${encodeURIComponent(city)}`);

export const runDiscovery = async (city: string) => {
  if (!supabase) {
    return call<{ events: YeloEvent[]; added: number; ms: number }>("/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city }),
    });
  }
  const run = await sbRun("events", city);
  return { ...run, events: await sbEvents(city) };
};


// Happy hours and standing specials come back from the agent with whatever date the
// source page had; show them as recurring instead of a one-off time.
const RECURRING = /happy hour|daily|every (day|night)|weekdays?|nightly|all day/i;

type WhenFields = Pick<YeloEvent, "start" | "category" | "title" | "deal">;

export const isRecurring = (e: WhenFields) => e.category === "deal" || RECURRING.test(`${e.title} ${e.deal ?? ""}`);

export function whenLabel(e: WhenFields) {
  const text = `${e.title} ${e.deal ?? ""}`;
  if (isRecurring(e)) return /happy hour/i.test(text) ? "Happy hour" : "Recurring deal";
  if (!e.start) return "Ongoing";
  const d = new Date(e.start);
  const today = new Date();
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 864e5);
  const day = days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// "Rooms": venues that could host a Yelo night (see server/leads.ts).
export type Lead = {
  id: string;
  venue: string;
  area: string;
  address: string;
  kind: string;
  capacity: string | null;
  fit: string;
  quietNight: string | null;
  contact: string | null;
  url: string | null;
  confidence: "low" | "medium" | "high";
};

export const getLeads = async (city: string) =>
  supabase ? { leads: await sbRooms(city) } : call<{ leads: Lead[] }>(`/leads?city=${encodeURIComponent(city)}`);

export const runLeads = async (city: string) => {
  if (!supabase) {
    return call<{ leads: Lead[]; added: number; ms: number }>("/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city }),
    });
  }
  const run = await sbRun("rooms", city);
  return { ...run, leads: await sbRooms(city) };
};
