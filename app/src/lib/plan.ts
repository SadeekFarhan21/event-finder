// "Plan my night": tonight's spots chained into a route a person could actually do, the way a friend
// who knows the city would: a happy hour that's on now, a show about an hour and a half later close by,
// then somewhere late. No network and no AI call: it picks from what the agent already found.
import { calmCaps } from "./case";
import { inviteBill } from "./invite";
import { km } from "./fare";
import { cityHour, clock, dealRank, dealStatus, isRecurring, nightEnd, shortTitle } from "./time";
import type { Spot } from "./types";

// step: "Start here" / "Then" / "Late"; hop: how far from the stop before ("0.4 mi", "a short walk").
export type Stop = { spot: Spot; step: string; hop: string | null };

const MAX_KM = 4; // further than this between stops and it stops feeling like one night out
const STAY = 90 * 60000; // time at a set before moving on
const LATE = ["nightlife", "music"];

export function planNight(spots: Spot[], now = Date.now(), me?: { lat: number; lng: number } | null): Stop[] {
  const end = nightEnd(now);
  const timed = spots.filter((e) => !isRecurring(e) && e.start && Date.parse(e.start) >= now - 20 * 60000 && Date.parse(e.start) < end);
  const usable = (e: Spot) => e.confidence !== "low";

  const stops: Stop[] = [];
  let at: { lat: number; lng: number } | null = me ?? null;
  let free = now; // when the rider is free to start the next stop

  // Open with a happy hour that's on right now, nearest first (partners win ties).
  const deals = spots.filter((e) => isRecurring(e) && usable(e) && dealRank(e, now) === 0);
  const near = (e: Spot) => (at ? km(at, e) : 0) - (e.partner ? 0.3 : 0);
  const opener = [...deals].sort((a, b) => near(a) - near(b))[0];
  if (opener && (!at || km(at, opener) <= MAX_KM)) {
    stops.push({ spot: opener, step: "Start here", hop: null });
    at = opener; free = now + 60 * 60000;
  }

  while (stops.length < 3) {
    const used = new Set(stops.map((s) => s.spot.venue.toLowerCase()));
    const prev = stops[stops.length - 1]?.spot;
    const cands = timed.filter((e) => usable(e) && !used.has(e.venue.toLowerCase()) && Date.parse(e.start!) >= free - 15 * 60000
      && (!at || km(at, e) <= MAX_KM));
    if (!cands.length) break;
    // Close by and soon; a different kind of night than the last stop; Yelo partners nudged up.
    // The last stop leans late (a club or a set), so the night ends somewhere with a room.
    const score = (e: Spot) => (at ? km(at, e) : 0) + (Date.parse(e.start!) - free) / 3600e3 * 0.8
      - (e.partner ? 0.5 : 0) + (prev && prev.category === e.category ? 0.6 : 0)
      + (stops.length === 2 && !LATE.includes(e.category) ? 1 : 0);
    const next = cands.sort((a, b) => score(a) - score(b))[0];
    const d = at && stops.length ? km(at, next) : null;
    const hop = d === null ? null : d < 0.5 ? "a short walk" : `${(d * 0.621).toFixed(1)} mi`;
    // "Late" only for what really is (9 PM to 6 AM in the city): a 7 PM set reads "Then".
    const h = cityHour(Date.parse(next.start!)), late = h >= 21 || h < 6;
    stops.push({ spot: next, step: stops.length === 0 ? "Start here" : late && stops.length === 2 ? "Late" : "Then", hop });
    at = next; free = Date.parse(next.start!) + STAY;
  }
  // One stop isn't a plan; the regular list already shows it.
  return stops.length >= 2 ? stops : [];
}

// The plan as a text to friends: each stop with its time and its link, in order.
// "Tonight's plan:\n1. 11th Street Bar · happy hour, until 7 PM\nhttps://…\n2. Nublu · 8 PM, Mike Monford…"
// With a whole-plan link the stops read as a short list and the one link goes last; otherwise
// each stop carries its own link.
export function planMessage(stops: Stop[], link: (e: Spot) => string, whole?: string | null): string {
  // The billing by the same rule as every shared message: calm caps, never just the venue's name again
  // ("Nublu · 8 PM", not "…, Nublu").
  const bill = (e: Spot) => inviteBill(e.title, e.venue, 40) || null;
  const when = (e: Spot) => {
    if (isRecurring(e) || !e.start) {
      // A deal says what it is ("$5 drafts"), then its hours when the listing states them.
      const what = /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "happy hour" : e.deal ? shortTitle(calmCaps(e.deal), 40) : bill(e);
      const hours = dealStatus(e)?.replace(/^On /, "").replace(/^From/, "from");
      return [what, hours].filter(Boolean).join(", ");
    }
    return [clock(new Date(e.start)), bill(e)].filter(Boolean).join(", ");
  };
  const line = (s: Stop, i: number) => `${i + 1}. ${[s.spot.venue, when(s.spot)].filter(Boolean).join(" · ")}`;
  if (whole) return ["Tonight's plan:", ...stops.map(line), whole].join("\n");
  return ["Tonight's plan:", ...stops.map((s, i) => `${line(s, i)}\n${link(s.spot)}`)].join("\n");
}
