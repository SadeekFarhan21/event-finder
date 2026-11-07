// Engagement logging for the venue dashboard: views, ride taps, unlocks, shares, "going".
// Never blocks the UI or shows errors; rows that fail to send are queued and retried (below).
// Identity is a random id per install, kept on the device. No account, nothing personal.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import type { Spot } from "../lib/types";
import { supabase } from "./supabase";
import { onNetworkChange } from "../lib/net";

export type ActivityKind = "view" | "ride" | "unlock" | "share" | "going" | "save";

let deviceId: Promise<string> | null = null;

export function getDeviceId() {
  deviceId ??= (async () => {
    const saved = await AsyncStorage.getItem("scout.deviceId").catch(() => null);
    if (saved) return saved;
    const fresh = randomUUID();
    await AsyncStorage.setItem("scout.deviceId", fresh).catch(() => {});
    return fresh;
  })();
  return deviceId;
}

// Opening the same spot repeatedly in one session counts once.
const seen = new Set<string>();

type Row = { spot_id: string; venue: string; city: string; kind: ActivityKind; device_id: string };

// Rows that couldn't be sent (offline, timeout) wait on the device and go out when the connection
// returns or on the next launch. A lost "I'm going" means friends never see you coming.
const QUEUE_KEY = "scout.activityQueue";
const loadQueue = async (): Promise<Row[]> => JSON.parse((await AsyncStorage.getItem(QUEUE_KEY).catch(() => null)) ?? "[]");
const saveQueue = (rows: Row[]) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-100))).catch(() => {});

const send = async (row: Row) => {
  try { return !(await supabase!.from("spot_activity").insert(row)).error; } catch { return false; }
};

let flushing = false;
export async function flushActivity() {
  if (!supabase || flushing) return;
  flushing = true;
  try {
    const rows = await loadQueue();
    if (!rows.length) return;
    const left: Row[] = [];
    for (const r of rows) if (!(await send(r))) left.push(r);
    await saveQueue(left);
  } finally { flushing = false; }
}
onNetworkChange((off) => { if (!off) flushActivity(); });
flushActivity();

export function track(spot: Spot, kind: ActivityKind, city: string) {
  if (!supabase) return; // local dev server has no activity table
  if (kind === "view") {
    if (seen.has(spot.id)) return;
    seen.add(spot.id);
  }
  getDeviceId().then(async (device_id) => {
    const row: Row = { spot_id: spot.id, venue: spot.venue, city: city.trim().toLowerCase(), kind, device_id };
    if (!(await send(row))) await saveQueue([...(await loadQueue()), row]);
  }).catch(() => {});
}
