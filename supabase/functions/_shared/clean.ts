// Cleanup shared by the agent (new results) and the store (merging runs).
import type { YeloEvent } from "./discover.ts";

// "Connolly's Pub (Times Square)" -> "Connolly's Pub"
// "Dr. Martens Brand Centre, Herald Square" -> "Dr. Martens Brand Centre"
// "The Cabinet Mezcal Bar / Miracle on 9th Street" -> "The Cabinet Mezcal Bar"
// "Superior Ingredients – The Roof" -> "Superior Ingredients"
export function cleanVenue(name: string) {
  const short = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/\s+[\/|–—-]\s+|,\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return short.length >= 3 ? short : name.trim();
}

// "Happy Hour at Cubbyhole (Recurring)" -> "Happy Hour"; drops a trailing "at/@ <venue>"
// (the sheet already shows the venue) and bracketed notes like "(Recurring)" or "[21+]".
export function cleanTitle(title: string, venue: string) {
  let t = title.replace(/\s*[([][^)\]]*[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();
  const v = cleanVenue(venue).toLowerCase().replace(/^the\s+/, "");
  const m = /\s(?:at|@)\s+(.+)$/i.exec(t);
  if (m && m[1].toLowerCase().replace(/^the\s+/, "").startsWith(v.slice(0, 6))) t = t.slice(0, m.index).trim();
  if (t.toLowerCase().startsWith(v + " ") && t.length > v.length + 6) t = t.slice(v.length).replace(/^[\s:–—-]+/, "");
  return t.length >= 3 ? t : title.trim();
}

const key = (s: string) => cleanVenue(s).toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
const RANK = { low: 0, medium: 1, high: 2 } as const;
const STANDING = /happy hour|daily|every (day|night)|weekdays?|nightly|all day/i;
const isStanding = (e: YeloEvent) => e.category === "deal" || STANDING.test(`${e.title} ${e.deal ?? ""}`);

// Two listings are the same spot if they're at the same venue and either both are standing
// deals, or they start within 8 hours of each other. Keeps the higher-confidence one
// (newer wins ties), and carries over a deal the winner is missing.
// Same room under two names: "Nublu" and "Nublu 151", "Elsewhere" and "Elsewhere Hall". One name
// extends the other by whole words and the pins are within a block (~150 m).
function sameVenue(a: YeloEvent, b: YeloEvent) {
  const ka = key(a.venue), kb = key(b.venue);
  if (ka === kb) return true;
  const wa = words(a.venue), wb = words(b.venue);
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const prefix = short.length > 0 && short.join(" ").length >= 4 && short.every((w, i) => long[i] === w);
  const near = Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 85) < 0.15;
  return prefix && near;
}
const words = (s: string) => cleanVenue(s).toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);

export function dedupeEvents(events: YeloEvent[]): YeloEvent[] {
  const kept: YeloEvent[] = [];
  for (const e of [...events].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))) {
    const twin = kept.find((k) =>
      sameVenue(k, e) &&
      (isStanding(k) && isStanding(e)
        ? true
        : !isStanding(k) && !isStanding(e) && k.start && e.start && Math.abs(Date.parse(k.start) - Date.parse(e.start)) < 8 * 3600e3),
    );
    if (!twin) {
      kept.push({ ...e, venue: cleanVenue(e.venue), title: cleanTitle(e.title, e.venue) });
      continue;
    }
    if (RANK[e.confidence] > RANK[twin.confidence]) Object.assign(twin, { ...e, venue: cleanVenue(e.venue), title: cleanTitle(e.title, e.venue), deal: e.deal ?? twin.deal, image: e.image ?? twin.image });
    else {
      if (!twin.deal && e.deal) twin.deal = e.deal;
      if (!twin.image && e.image) twin.image = e.image;
    }
  }
  return kept;
}
