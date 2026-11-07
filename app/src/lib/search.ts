// Search the spots already on the map: "jazz", "free", "rooftop brooklyn", "under $20".
// Every word must match something about the spot (name, title, area, description, deal, type),
// so adding words narrows. No network, no AI: instant, and it works offline.
import type { Spot } from "./types";
import { CATEGORY } from "../theme";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Words people use for a kind of night that the listing may not spell out.
const ALIASES: Record<string, string[]> = {
  free: ["free", "no cover", "$0"],
  drinks: ["drink", "bar", "cocktail", "beer", "wine", "happy hour"],
  dance: ["dance", "dj", "club", "techno", "house"],
  live: ["live", "band", "concert", "music"],
};

export type Query = { words: string[]; maxPrice: number | null };

export function parseQuery(text: string): Query {
  let t = fold(text);
  let maxPrice: number | null = null;
  // "under $20", "below 15", "< $30"
  t = t.replace(/(?:under|below|less than|<)\s*\$?\s*(\d+)/g, (_, n) => { maxPrice = Number(n); return " "; });
  const words = t.split(/[^a-z0-9$&+]+/).filter((w) => w.length > 1);
  return { words, maxPrice };
}

// Lowest dollar amount the listing mentions; free entry counts as 0; unknown is null.
export function priceOf(e: Pick<Spot, "price" | "deal">): number | null {
  const text = `${e.price ?? ""} ${e.deal ?? ""}`;
  if (/\bfree\b|no cover/i.test(text)) return 0;
  const n = text.match(/\$\s*(\d+)/g)?.map((m) => Number(m.replace(/\D/g, "")));
  return n?.length ? Math.min(...n) : null;
}

export function matchesQuery(e: Spot, q: Query): boolean {
  if (!q.words.length && q.maxPrice === null) return true;
  if (q.maxPrice !== null) {
    const p = priceOf(e);
    if (p === null || p > q.maxPrice) return false;
  }
  const hay = fold([e.venue, e.title, e.description, e.deal, e.price, e.address, CATEGORY[e.category]?.label].filter(Boolean).join(" "));
  return q.words.every((w) => (ALIASES[w] ?? [w]).some((a) => hay.includes(a)));
}

// Searching a place by name ("nublu", "gold diggers") puts that venue first; everything else keeps
// the usual order. Stable: spots that tie stay as they were.
export function rankByVenue<T extends Pick<Spot, "venue">>(spots: T[], q: Query): T[] {
  if (!q.words.length) return spots;
  const named = (e: T) => q.words.every((w) => fold(e.venue).includes(w));
  return [...spots].sort((a, b) => Number(named(b)) - Number(named(a)));
}
