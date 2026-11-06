// Engagement logging for the venue dashboard: views, ride taps, unlocks, shares, "going".
// Fire-and-forget: never blocks the UI and never surfaces errors to the person tapping.
// Identity is a random id per install, kept on the device. No account, nothing personal.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import type { Spot } from "../lib/types";
import { supabase } from "./supabase";

export type ActivityKind = "view" | "ride" | "unlock" | "share" | "going";

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

export function track(spot: Spot, kind: ActivityKind, city: string) {
  if (!supabase) return; // local dev server has no activity table
  if (kind === "view") {
    if (seen.has(spot.id)) return;
    seen.add(spot.id);
  }
  getDeviceId()
    .then((device_id) => supabase!.from("spot_activity").insert({
      spot_id: spot.id, venue: spot.venue, city: city.trim().toLowerCase(), kind, device_id,
    }))
    .catch(() => {});
}
