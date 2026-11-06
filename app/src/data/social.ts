// "Going" and invites: the social layer. No accounts, so "going" is per device. Counts come from
// spot_activity (kind 'going', unique devices), and what this device said lives on the device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spot } from "../lib/types";
import { whenLabel } from "../lib/time";
import { supabase } from "./supabase";

const MINE_KEY = "scout.going";
export const SITE = "https://scout-download.vercel.app";

export async function goingCounts(ids: string[]): Promise<Record<string, number>> {
  if (!supabase || !ids.length) return {};
  const { data } = await supabase.rpc("going_counts", { p_spot_ids: ids });
  return Object.fromEntries(((data ?? []) as { spot_id: string; going: number }[]).map((r) => [r.spot_id, Number(r.going)]));
}

export async function loadMine(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(MINE_KEY).catch(() => null);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

export const saveMine = (mine: Set<string>) =>
  AsyncStorage.setItem(MINE_KEY, JSON.stringify([...mine].slice(-200))).catch(() => {});

// The link opens a web page for the night (works without the app), with a ride and download link.
export const spotLink = (e: Spot) => `${SITE}/e.html?id=${encodeURIComponent(e.id)}`;

export const inviteMessage = (e: Spot, going: boolean) =>
  `${going ? "I'm going to" : "Want to go to"} ${e.title} at ${e.venue}, ${whenLabel(e).toLowerCase()}. Come with? ${spotLink(e)}`;
