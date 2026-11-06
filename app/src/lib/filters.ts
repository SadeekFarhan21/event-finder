// The chips under the search bar, and the order spots appear in.
import { CATEGORY } from "../theme";
import { isRecurring, nightEnd } from "./time";
import type { Category, Spot } from "./types";

export type Filter = Category | "all" | "tonight";

export const FILTERS: Filter[] = ["all", "tonight", ...(Object.keys(CATEGORY) as Category[])];

export const filterLabel = (f: Filter) => (f === "all" ? "All" : f === "tonight" ? "Tonight" : CATEGORY[f].label);

// "Tonight" = dated events from now until 6am, plus standing deals (happy hours run every day).
export function matches(e: Spot, f: Filter) {
  if (f === "all") return true;
  if (f === "tonight") {
    if (isRecurring(e)) return true;
    if (!e.start) return false;
    const t = Date.parse(e.start);
    return t > Date.now() - 3 * 3600e3 && t < nightEnd();
  }
  return e.category === f;
}

// Yelo partners first, then soonest; standing deals after dated events.
export function sortSpots(spots: Spot[]) {
  const t = (e: Spot) => (e.start && !isRecurring(e) ? Date.parse(e.start) : Infinity);
  return [...spots].sort((a, b) => Number(!!b.partner) - Number(!!a.partner) || t(a) - t(b));
}
