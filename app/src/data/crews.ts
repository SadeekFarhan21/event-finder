// Crews: friends heading to the same spot together. The server keeps crews and names; this
// device remembers which crews it's in (codes) and the name its owner goes by.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDeviceId } from "./activity";
import { SITE } from "./social";
import { supabase } from "./supabase";

export type CrewStatus = "in" | "on_way" | "out";
export type CrewMember = { name: string; status: CrewStatus; me: boolean };
export type Crew = {
  code: string; spotId: string; leaveAt: string; venue: string; title: string; address: string;
  lat: number; lng: number; start: string | null; members: CrewMember[];
};

const CODES_KEY = "scout.crews";
const NAME_KEY = "scout.name";

export const crewLink = (code: string) => `${SITE}/e.html?crew=${code}`;
export const crewsAvailable = () => !!supabase;

export async function myCodes(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CODES_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as string[]) : [];
}
const remember = async (code: string) => {
  const codes = [code, ...(await myCodes()).filter((c) => c !== code)].slice(0, 30);
  await AsyncStorage.setItem(CODES_KEY, JSON.stringify(codes)).catch(() => {});
};

export const savedName = () => AsyncStorage.getItem(NAME_KEY).catch(() => null);
const saveName = (name: string) => AsyncStorage.setItem(NAME_KEY, name.trim()).catch(() => {});

// RPC errors are written for people ("Crew not found"); surface them as-is.
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export async function startCrew(spotId: string, leaveAt: Date, name: string): Promise<string> {
  const { data, error } = await supabase!.rpc("start_crew", {
    p_spot_id: spotId, p_leave_at: leaveAt.toISOString(), p_device_id: await getDeviceId(), p_name: name,
  });
  fail(error);
  await Promise.all([remember(data as string), saveName(name)]);
  return data as string;
}

export async function joinCrew(code: string, name: string) {
  const clean = code.trim().toLowerCase().replace(/^.*crew=/, "");
  const { error } = await supabase!.rpc("join_crew", { p_code: clean, p_device_id: await getDeviceId(), p_name: name });
  fail(error);
  await Promise.all([remember(clean), saveName(name)]);
  return clean;
}

export async function setStatus(code: string, status: CrewStatus) {
  const { error } = await supabase!.rpc("set_crew_status", { p_code: code, p_device_id: await getDeviceId(), p_status: status });
  fail(error);
}

export async function loadCrews(): Promise<Crew[]> {
  const codes = await myCodes();
  if (!supabase || !codes.length) return [];
  const { data, error } = await supabase.rpc("get_crews", { p_codes: codes, p_device_id: await getDeviceId() });
  fail(error);
  type Row = { code: string; spot_id: string; leave_at: string; venue: string; title: string; address: string;
    lat: number; lng: number; start: string | null; members: CrewMember[] };
  return ((data ?? []) as Row[])
    .map((r) => ({ code: r.code, spotId: r.spot_id, leaveAt: r.leave_at, venue: r.venue, title: r.title, address: r.address,
      lat: r.lat, lng: r.lng, start: r.start, members: r.members }))
    // Soonest first; nights that ended (left more than 8 hours ago) drop off.
    .filter((c) => Date.parse(c.leaveAt) > Date.now() - 8 * 3600e3)
    .sort((a, b) => Date.parse(a.leaveAt) - Date.parse(b.leaveAt));
}

export const crewInvite = (c: { venue: string; title: string; leaveAt: string; code: string }) =>
  `Heading to ${c.title} at ${c.venue}, leaving ${leaveLabel(c.leaveAt).toLowerCase()}. Join the crew: ${crewLink(c.code)}`;

export function leaveLabel(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0 && mins > -90) return "Now";
  if (mins > 0 && mins < 60) return `In ${mins} min`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `At ${time}` : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}
