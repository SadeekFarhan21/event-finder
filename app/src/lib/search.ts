// Search the spots already on the map: "jazz", "free", "rooftop brooklyn", "under $20".
// Every word must match something about the spot (name, title, area, description, deal, type),
// so adding words narrows. No network, no AI: instant, and it works offline.
import type { Spot } from "./types";
import { CATEGORY } from "../theme";
import { cityHour, isRecurring, nightOffset, nightWeekday } from "./time";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Words people use for a kind of night that the listing may not spell out.
const ALIASES: Record<string, string[]> = {
  free: ["free", "no cover", "$0"],
  drinks: ["drink", "bar", "cocktail", "beer", "wine", "happy hour"],
  dance: ["dance", "dj", "club", "techno", "house"],
  live: ["live", "band", "concert", "music"],
};

export type When = "tonight" | "tomorrow" | "weekend";
export type Query = { words: string[]; maxPrice: number | null; when: When | null; near?: boolean; after?: number; weekday?: number }; // after: hour 0-23, city time; weekday: 0 Sun … 6 Sat

export function parseQuery(text: string): Query {
  let t = fold(text);
  let maxPrice: number | null = null;
  // "under $20", "below 15", "< $30"
  t = t.replace(/(?:under|below|less than|<)\s*\$?\s*(\d+)/g, (_, n) => { maxPrice = Number(n); return " "; });
  // "jazz tomorrow", "free tonight", "this weekend": a day, not a word to match in the listing.
  let when: When | null = null;
  // "jazz friday", "techno on saturday": that night in the coming week, not a word to match.
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let weekday: number | undefined;
  t = t.replace(/\b(?:on\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/g, (_, d) => { weekday = DAYS.indexOf(d); return " "; });
  t = t.replace(/\b(this\s+)?(tonight|today|tomorrow|weekend)\b/g, (_, __, w) => {
    when = w === "today" ? "tonight" : (w as When); return " ";
  });
  // "after 10", "after 9:30pm", "after 11 pm", "late night", "late": a starting hour, not words to match.
  // A bare "after 10" means the evening (10 PM); "after 10am" stays morning.
  let after: number | undefined;
  t = t.replace(/\bafter\s+(\d{1,2})(?::\d\d)?\s*(am|pm)?\b/g, (_, h, ap) => {
    const n = Number(h) % 12;
    // With am/pm, as said. Without: 1-5 are the small hours ("techno after 1" means 1 AM, not 1 PM),
    // 6-11 the evening, 12 midnight.
    after = ap === "am" ? n : ap === "pm" ? n + 12 : n === 0 ? 0 : n <= 5 ? n : n + 12;
    return " ";
  });
  t = t.replace(/\blate(?:[\s-]?night)?\b/g, () => { after ??= 22; return " "; });
  // "jazz near me", "free nearby", "drinks close by": a place to filter by, not words to match.
  let near = false;
  t = t.replace(/\b(near me|nearby|close by|around me|walking distance)\b/g, () => { near = true; return " "; });
  const words = t.split(/[^a-z0-9$&+]+/).filter((w) => w.length > 1);
  return { words, maxPrice, when, near, after, weekday };
}

// Lowest dollar amount the listing mentions; free entry counts as 0; unknown is null.
export function priceOf(e: Pick<Spot, "price" | "deal">): number | null {
  const text = `${e.price ?? ""} ${e.deal ?? ""}`;
  if (/\bfree\b|no cover/i.test(text)) return 0;
  const n = text.match(/\$\s*(\d+)/g)?.map((m) => Number(m.replace(/\D/g, "")));
  return n?.length ? Math.min(...n) : null;
}

export function matchesQuery(e: Spot, q: Query, now = Date.now()): boolean {
  if (!q.words.length && q.maxPrice === null && !q.when && q.after === undefined && q.weekday === undefined) return true; // "near me" alone: the screen narrows by distance
  if (q.weekday !== undefined && !isRecurring(e)) {
    // That night within the coming week (a 1 AM set on Saturday morning still belongs to Friday night).
    if (!e.start) return false;
    const t = Date.parse(e.start), d = nightOffset(t, now);
    if (d < 0 || d > 6 || nightWeekday(t) !== q.weekday) return false;
  }
  if (q.after !== undefined) {
    // Starts at or after that hour on the city's clock; past midnight still counts (a 1 AM set is late).
    // Standing deals have no start to compare, so a time search leaves them out.
    if (isRecurring(e) || !e.start) return false;
    const h = cityHour(Date.parse(e.start));
    // An evening hour reaches past midnight; a small-hours one (1 AM) only runs to 6 AM, so 7 PM isn't "after 1".
    const ok = q.after >= 12 ? h >= q.after || h < 6 : q.after < 6 ? h >= q.after && h < 6 : h >= q.after;
    if (!ok) return false;
  }
  if (q.when && !isRecurring(e)) { // standing deals run every day, so they fit any day
    if (!e.start) return false;
    const t = Date.parse(e.start), d = nightOffset(t, now);
    if (q.when === "tonight" && d !== 0) return false;
    if (q.when === "tomorrow" && d !== 1) return false;
    // This weekend: Fri, Sat and Sun nights up to this coming Sunday (on a Saturday, not next Friday).
    const toSunday = (7 - nightWeekday(now)) % 7;
    if (q.when === "weekend" && (d < 0 || d > toSunday || ![5, 6, 0].includes(nightWeekday(t)))) return false;
  }
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
