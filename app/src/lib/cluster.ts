import type { Region } from "../map/types";
import type { Spot } from "./types";

export type Cluster = { key: string; lat: number; lng: number; events: Spot[] };

// Grid clustering: bucket pins into cells ~1/6 of the visible map width,
// so pins that would overlap at this zoom collapse into one numbered bubble.
export function clusterEvents(events: Spot[], region: Region): Cluster[] {
  const cell = region.longitudeDelta / 6;
  const buckets = new Map<string, Spot[]>();
  for (const e of events) {
    const key = `${Math.floor(e.lat / cell)}:${Math.floor(e.lng / cell)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), e]);
  }
  const clusters = [...buckets].map(([key, group]) => toCluster(key, group));

  // Pins near a cell edge land in neighboring buckets and render on top of each other;
  // fold any two clusters closer than ~60% of a cell into one.
  const merged: Cluster[] = [];
  for (const c of clusters) {
    const near = merged.find((m) => Math.hypot(m.lat - c.lat, m.lng - c.lng) < cell * 0.6);
    if (near) Object.assign(near, toCluster(near.key, [...near.events, ...c.events]));
    else merged.push(c);
  }
  return merged;
}

const toCluster = (key: string, group: Spot[]): Cluster => ({
  key,
  events: group,
  lat: group.reduce((sum, e) => sum + e.lat, 0) / group.length,
  lng: group.reduce((sum, e) => sum + e.lng, 0) / group.length,
});

// The dense middle of a set of pins: the 75% closest to the median point.
// Used for the camera so a few far-flung spots don't zoom the map way out. Scales with
// the city: tight for Manhattan, wider for spread-out LA.
export function coreOf(events: Spot[], share = 0.75): Spot[] {
  if (events.length < 4) return events;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const lat = median(events.map((e) => e.lat));
  const lng = median(events.map((e) => e.lng));
  const kmPerDegLng = 111 * Math.cos((lat * Math.PI) / 180);
  const dist = (e: Spot) => Math.hypot((e.lat - lat) * 111, (e.lng - lng) * kmPerDegLng);
  return [...events].sort((a, b) => dist(a) - dist(b)).slice(0, Math.max(3, Math.ceil(events.length * share)));
}
