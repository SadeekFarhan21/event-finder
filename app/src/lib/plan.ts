// "Plan my night": tonight's spots chained into a route a person could actually do, the way a friend
// who knows the city would: a happy hour that's on now, a show about an hour and a half later close by,
// then somewhere late. No network and no AI call: it picks from what the agent already found.
import { calmCaps } from "./case";
import { inviteBill } from "./invite";
import { km } from "./fare";
import { cityHour, clock, dealRank, dealStatus, eveningAfter, isRecurring, nightEnd, nightOffset, shortTitle } from "./time";
import type { Spot } from "./types";

// step: "Start here" / "Then" / "Late"; hop: how far from the stop before ("0.4 mi", "a short walk").
// day: set when the plan is for a later night ("Tomorrow"), so every card and the text say so.
export type Stop = { spot: Spot; step: string; hop: string | null; day?: string };

const MAX_KM = 4; // further than this between stops and it stops feeling like one night out
const STAY = 90 * 60000; // time at a set before moving on
const LATE = ["nightlife", "music"];

export function planNight(spots: Spot[], now = Date.now(), me?: { lat: number; lng: number } | null): Stop[] {
  const end = nightEnd(now);
  const usable = (e: Spot) => e.confidence !== "low";
  const timed = spots.filter((e) => usable(e) && !isRecurring(e) && e.start && Date.parse(e.start) >= now - 20 * 60000 && Date.parse(e.start) < end);
  // Start from the rider only when they're in this city: browsing LA from New York, every stop is
  // thousands of km from "here" and nothing would ever fit.
  const here = me && spots.some((e) => km(me, e) <= 25) ? me : null;
  const reach = (e: Spot) => !here || km(here, e) <= MAX_KM;
  const fromHere = (e: Spot) => (here ? km(here, e) : 0) - (e.partner ? 0.3 : 0);

  // The route from one first stop: greedy, close by and soon after the one before.
  function build(seed: Spot | null): Stop[] {
    const stops: Stop[] = [];
    let at: { lat: number; lng: number } | null = here;
    let free = now; // when the rider is free to start the next stop
    if (seed) {
      stops.push({ spot: seed, step: "Start here", hop: null });
      at = seed; free = isRecurring(seed) ? now + 60 * 60000 : Date.parse(seed.start!) + STAY;
    }
    while (stops.length < 3) {
      const used = new Set(stops.map((s) => s.spot.venue.toLowerCase()));
      const prev = stops[stops.length - 1]?.spot;
      const cands = timed.filter((e) => !used.has(e.venue.toLowerCase()) && Date.parse(e.start!) >= free - 15 * 60000
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
    return stops;
  }

  // Try first stops in order of preference until one leads somewhere: a happy hour on now (nearest,
  // partners first), then the soonest sets. One isolated pick used to sink the whole plan, so swapping
  // out a stop left nothing.
  const deals = spots.filter((e) => isRecurring(e) && usable(e) && dealRank(e, now) === 0 && reach(e)).sort((a, b) => fromHere(a) - fromHere(b));
  const firsts = timed.filter(reach).sort((a, b) => Date.parse(a.start!) + fromHere(a) * 3600e3 - Date.parse(b.start!) - fromHere(b) * 3600e3);
  for (const seed of [...deals.slice(0, 6), ...firsts.slice(0, 6)]) {
    const p = build(seed);
    if (p.length >= 2) return p;
  }
  // One stop isn't a plan; the regular list already shows it.
  return [];
}

// The plan as a text to friends: each stop with its time and its link, in order.
// "Tonight's plan:\n1. 11th Street Bar · happy hour, until 7 PM\nhttps://…\n2. Nublu · 8 PM, Mike Monford…"
// With a whole-plan link the stops read as a short list and the one link goes last; otherwise
// each stop carries its own link.
export function planMessage(stops: Stop[], link: (e: Spot) => string, whole?: string | null): string {
  const head = stops[0]?.day ? `${stops[0].day}'s plan:` : "Tonight's plan:";
  // The billing by the same rule as every shared message: calm caps, never just the venue's name again
  // ("Nublu · 8 PM", not "…, Nublu").
  const bill = (e: Spot) => inviteBill(e.title, e.venue, 40) || null;
  const when = (e: Spot, day?: string) => {
    if (isRecurring(e) || !e.start) {
      // A deal says what it is ("$5 drafts"), then its hours when the listing states them.
      const what = /happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "happy hour" : e.deal ? shortTitle(calmCaps(e.deal), 40) : bill(e);
      const hours = dealStatus(e, day ? eveningAfter() : undefined)?.replace(/^On /, "").replace(/^From/, "from"); // a later night: its evening, not now
      return [what, hours].filter(Boolean).join(", ");
    }
    return [clock(new Date(e.start)), bill(e)].filter(Boolean).join(", ");
  };
  const line = (s: Stop, i: number) => `${i + 1}. ${[s.spot.venue, when(s.spot, s.day)].filter(Boolean).join(" · ")}`;
  if (whole) return [head, ...stops.map(line), whole].join("\n");
  return [head, ...stops.map((s, i) => `${line(s, i)}\n${link(s.spot)}`)].join("\n");
}

// Tonight's plan, or when tonight can't make one (late, or little left), tomorrow evening's.
export function planAhead(spots: Spot[], now = Date.now(), me?: { lat: number; lng: number } | null): Stop[] {
  const tonight = planNight(spots, now, me);
  if (tonight.length) return tonight;
  return planNight(spots, eveningAfter(now), me).map((s) => ({ ...s, day: "Tomorrow" }));
}

// A plan a friend shared (scout://plan/<short>,<short>,…): the same stops in their order, labelled the
// way the planner would. Stops no longer on the map drop out; fewer than two isn't a plan.
export function planFromShorts(spots: Spot[], shorts: string[], now = Date.now()): Stop[] {
  const list = shorts.map((s) => spots.find((e) => e.short === s)).filter((e): e is Spot => !!e);
  if (list.length < 2) return [];
  const timed = list.find((e) => e.start && !isRecurring(e));
  const day = timed && nightOffset(Date.parse(timed.start!), now) === 1 ? "Tomorrow" : undefined;
  return list.map((spot, i) => {
    const d = i ? km(list[i - 1], spot) : null;
    const h = spot.start && !isRecurring(spot) ? cityHour(Date.parse(spot.start)) : 12;
    const step = i === 0 ? "Start here" : (h >= 21 || h < 6) && i === list.length - 1 ? "Late" : "Then";
    return { spot, step, hop: d === null ? null : d < 0.5 ? "a short walk" : `${(d * 0.621).toFixed(1)} mi`, day };
  });
}
