// "Going" and invites: the social layer. No accounts, so "going" is per device. Counts come from
// spot_activity (kind 'going', unique devices), and what this device said lives on the device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spot } from "../lib/types";
import { shortTitle, whenPhrase } from "../lib/time";
import { supabase } from "./supabase";
import { getDeviceId } from "./activity";

const MINE_KEY = "scout.going";
import { config } from "../config";

export const SITE = config.siteUrl;

export async function goingCounts(ids: string[]): Promise<Record<string, number>> {
  if (!supabase || !ids.length) return {};
  const { data } = await supabase.rpc("going_counts", { p_spot_ids: ids });
  return Object.fromEntries(((data ?? []) as { spot_id: string; going: number }[]).map((r) => [r.spot_id, Number(r.going)]));
}

export async function loadMine(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(MINE_KEY).catch(() => null);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// Take back "I'm going" (only this device's tap; the server checks the device id).
export async function ungo(spotId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("ungo", { p_spot_id: spotId, p_device_id: await getDeviceId() });
  if (error) throw new Error(error.message);
}

export const saveMine = (mine: Set<string>) =>
  AsyncStorage.setItem(MINE_KEY, JSON.stringify([...mine].slice(-200))).catch(() => {});

// The link opens a web page for the night (works without the app), with a ride and download link.
export const spotLink = (e: Spot) => `${SITE}/e.html?id=${encodeURIComponent(e.id)}`;

export const inviteMessage = (e: Spot, going: boolean) =>
  `${going ? "I'm going to" : "Come to"} ${e.venue} ${whenPhrase(e)}: ${shortTitle(e.title)}. ${spotLink(e)}`;
