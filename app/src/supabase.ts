// Supabase backend (Yelo's stack). Set EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local to use it; otherwise the app
// talks to the local dev server in /server.
import { createClient } from "@supabase/supabase-js";
import type { Lead, YeloEvent } from "./api";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// No sign-in in this prototype, so no session storage.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

const cityKey = (c: string) => c.trim().toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sbEvents(city: string): Promise<YeloEvent[]> {
  const { data, error } = await supabase!.from("upcoming_events").select("*").eq("city", cityKey(city));
  if (error) throw new Error(error.message);
  return (data ?? []) as YeloEvent[];
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
    if (run?.ms != null) return { added: run.added ?? 0, ms: run.ms };
  }
  return { added: 0, ms: Date.now() - started }; // still running; results will show on next load
}
