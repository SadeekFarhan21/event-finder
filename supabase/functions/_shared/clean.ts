// Cleanup shared by the agent (new results) and the store (merging runs).
import type { YeloEvent } from "./discover.ts";
import { calmCaps } from "./case.ts";

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
  let t = calmCaps(title).replace(/\s*[([][^)\]]*[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();
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
// The same listing found twice, whatever its deal text says: same start (within an hour) and one
// title contains the other ("Jai Wolf" / "Jai Wolf with Conrad.", "ALTO" / "ALTO – Electronic / House
// Party"). Deal text that mentions a happy hour used to class one twin as a standing deal and the
// other not, so they were never compared and both showed as cards.
function sameBilling(a: YeloEvent, b: YeloEvent) {
  if (!a.start || !b.start || Math.abs(Date.parse(a.start) - Date.parse(b.start)) >= 3600e3) return false;
  const ta = key(a.title), tb = key(b.title);
  return ta.length >= 3 && tb.length >= 3 && (ta.includes(tb) || tb.includes(ta));
}

// Same room under two names: "Nublu" and "Nublu 151", "Elsewhere" and "Elsewhere Hall". One name
// extends the other by whole words, and they share a street address or the pins are within a block
// (~150 m). The address check matters: geocoders can place one address a few blocks apart.
function sameVenue(a: YeloEvent, b: YeloEvent) {
  const ka = key(a.venue), kb = key(b.venue);
  if (ka === kb) return true;
  const wa = words(a.venue), wb = words(b.venue);
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const prefix = short.length > 0 && short.join(" ").length >= 4 && short.every((w, i) => long[i] === w);
  const near = Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 85) < 0.15;
  const street = (x: YeloEvent) => (x.address ?? "").split(",")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const sameStreet = street(a).length >= 6 && street(a) === street(b);
  return prefix && (near || sameStreet);
}
const words = (s: string) => cleanVenue(s).toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);

export function dedupeEvents(events: YeloEvent[]): YeloEvent[] {
  const kept: YeloEvent[] = [];
  for (const e of [...events].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))) {
    const twin = kept.find((k) =>
      sameVenue(k, e) &&
      ((isStanding(k) && isStanding(e)
        ? true
        : !isStanding(k) && !isStanding(e) && k.start && e.start && Math.abs(Date.parse(k.start) - Date.parse(e.start)) < 8 * 3600e3)
        || sameBilling(k, e)),
    );
    if (!twin) {
      kept.push({ ...e, venue: cleanVenue(e.venue), title: cleanTitle(e.title, e.venue) });
      continue;
    }
    // "New" means first found: a re-found listing keeps the earliest discovery time.
    const first = twin.discoveredAt < e.discoveredAt ? twin.discoveredAt : e.discoveredAt;
    // ...and keeps the earliest id: the share code (events.short) is derived from it, so links friends
    // already sent keep working. A standing deal's id includes the placeholder start the scrape gave it,
    // so every re-find used to mint a new id and break every link to it.
    const firstId = twin.discoveredAt <= e.discoveredAt ? twin.id : e.id;
    if (RANK[e.confidence] > RANK[twin.confidence]) Object.assign(twin, { ...e, venue: cleanVenue(e.venue), title: cleanTitle(e.title, e.venue), deal: e.deal ?? twin.deal, image: e.image ?? twin.image });
    else {
      if (!twin.deal && e.deal) twin.deal = e.deal;
      if (!twin.image && e.image) twin.image = e.image;
    }
    twin.discoveredAt = first;
    twin.id = firstId;
  }
  return kept;
}

// A deal has to offer something: a price, a discount, free entry, a happy hour, bottomless drinks.
// Scraped "deals" are often just notes from the venue's page ("Sushi reservations on Resy",
// "Themed holiday cocktails"), which would promise riders nothing at the door. The title counts
// too, since a happy hour's deal text is often just its hours ("Daily 5-7 PM").
const DEAL_VALUE = /(\$|%|\bfree\b|\boff\b|happy hour|\bhalf\b|discount|complimentary|\bcomp\b|2[- ]?for[- ]?1|two[- ]for[- ]one|\bbogo\b|buy one|no cover|reduced|special|bottomless|unlimited|open bar|\bhour\b|aperitivo)/i;
export const isRealDeal = (deal: string | null | undefined, title = "") => !!deal && DEAL_VALUE.test(`${deal} ${title}`);
