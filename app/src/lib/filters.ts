// The chips under the search bar, and the order spots appear in.
import { CATEGORY } from "../theme";
import { dealRank, isRecurring, nightEnd, nowWord } from "./time";
import type { Category, Spot } from "./types";

export type Filter = Category | "all" | "tonight" | "saved" | "near" | "plan"; // "saved": the rider's shortlist (matched by id on the map screen)

// When, a plan for tonight, then the three things people go out for.
export const FILTERS: Filter[] = ["tonight", "plan", "all", "music", "nightlife", "deal"];

export const filterLabel = (f: Filter) => (f === "plan" ? "Plan my night" : f === "near" ? "Near me" : f === "saved" ? "Saved" : f === "all" ? "This week" : f === "tonight" ? nowWord() : f === "music" ? "Music" : CATEGORY[f].label);

// "Tonight" = dated events from now until 6am, plus standing deals (happy hours run every day).
export function matches(e: Spot, f: Filter) {
  if (f === "all" || f === "saved" || f === "near" || f === "plan") return true; // "saved" is narrowed by id where the saved set lives
  if (f === "tonight") {
    if (isRecurring(e)) return true;
    if (!e.start) return false;
    const t = Date.parse(e.start);
    return t > Date.now() - 3 * 3600e3 && t < nightEnd();
  }
  return e.category === f;
}

// Yelo partners first, unconfirmed listings last, then soonest; standing deals after dated events.
export function sortSpots(spots: Spot[]) {
  const t = (e: Spot) => (e.start && !isRecurring(e) ? Date.parse(e.start) : Infinity);
  const shaky = (e: Spot) => Number(e.confidence === "low");
  // Order: sets still to come, then ones under way (began over 90 min ago), then standing deals.
  const now = Date.now();
  const stage = (e: Spot) => (t(e) === Infinity ? 2 : t(e) < now - 90 * 60000 ? 1 : 0);
  // Standing deals (happy hours) go after dated events even for partners: at 11 PM a 3-7 PM happy hour
  // shouldn't lead the night. Among dated events, Yelo partners still come first.
  const deal = (e: Spot) => Number(stage(e) === 2);
  // Among standing deals: on now first, then the soonest to start; then partners, as for events.
  const dr = (e: Spot) => (deal(e) ? dealRank(e, now) : 0);
  return [...spots].sort((a, b) => deal(a) - deal(b) || dr(a) - dr(b) || Number(!!b.partner) - Number(!!a.partner) || shaky(a) - shaky(b) || stage(a) - stage(b) || t(a) - t(b));
}
