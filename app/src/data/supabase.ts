// Supabase backend (Yelo's stack). Set EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local to use it; otherwise the app
// talks to the local dev server in /server.
import { createClient } from "@supabase/supabase-js";
import type { Lead, Spot } from "../lib/types";
import { cityKey } from "../lib/cities";

import { config } from "../config";
import { fetchWithTimeout } from "../lib/net";

// No sign-in in this prototype, so no session storage. Every request gets the shared timeout.
export const supabase = config.supabase
  ? createClient(config.supabase.url, config.supabase.key, {
      auth: { persistSession: false },
      global: { fetch: fetchWithTimeout(config.requestTimeoutMs) },
    })
  : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sbEvents(city: string): Promise<Spot[]> {
  const { data, error } = await supabase!.from("upcoming_events").select("*").eq("city", cityKey(city));
  if (error) throw new Error(error.message);
  return (data ?? []) as Spot[];
}

export async function sbRooms(city: string): Promise<Lead[]> {
  const { data, error } = await supabase!.from("rooms").select("*").eq("city", cityKey(city));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, quietNight: r.quiet_night }) as Lead);
}

// The scout function replies 202 and works in the background; follow its run row
// until it records a duration (success or error), then read the fresh results.
export async function sbRun(task: "events" | "rooms", city: string) {
  const { data, error } = await supabase!.functions.invoke("scout", { body: { task, city } });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  const runId = (data as { runId: number }).runId;
  const started = Date.now();
  while (Date.now() - started < 170_000) {
    await sleep(5000);
    const { data: run } = await supabase!.from("scout_runs").select("added,ms,error").eq("id", runId).single();
    if (run?.error) throw new Error(run.error);
    if (run?.ms != null) return { added: run.added ?? 0, ms: run.ms, pending: false };
  }
  return { added: 0, ms: Date.now() - started, pending: true }; // still running server-side
}

// When the scout agent last searched this city on its own (pg_cron runs it every few minutes).
export async function sbLastRun(city: string): Promise<{ ranAt: string; added: number } | null> {
  const { data } = await supabase!.from("scout_runs").select("ran_at, added").eq("kind", "events")
    .eq("city", cityKey(city)).is("error", null).order("ran_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { ranAt: data.ran_at, added: data.added ?? 0 } : null;
}
