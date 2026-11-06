// "New" = first found by the agent in the last 24 hours. discovered_at is first-seen on the
// server (it never moves forward), so a listing the agent re-finds doesn't look new again.
import type { Spot } from "./types";

export const NEW_WINDOW_MS = 24 * 3600e3;

export const isNew = (e: Spot, now = Date.now()) =>
  !!e.discovered_at && now - Date.parse(e.discovered_at) < NEW_WINDOW_MS;

export const newIds = (spots: Spot[], now = Date.now()) => new Set(spots.filter((e) => isNew(e, now)).map((e) => e.id));
