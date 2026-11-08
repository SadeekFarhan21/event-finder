// Unit tests for the app's pure logic (no React Native imports at runtime).
// Run from the repo root: deno test --unstable-sloppy-imports --no-check tests/
// (Deno, like the function tests, so there's no extra test dependency in the app.)
import { expect } from "jsr:@std/expect@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import type { Spot } from "../app/src/lib/types";
import { clock, eveningAfter, shortTitle, dealDays, dealHours, dealStatus, isRecurring, nightEnd, otherDayPrefix, setCityZone, whenLabel } from "../app/src/lib/time";
import { matches, sortSpots } from "../app/src/lib/filters";
import { clusterEvents, coreOf } from "../app/src/lib/cluster";
import { estimateFare, km, milesLabel } from "../app/src/lib/fare";
import { canonicalCity, cityKey } from "../app/src/lib/cities";
import { similar } from "../app/src/lib/case";
import { inviteBill, withBill } from "../app/src/lib/invite";
import { goingLine, initials, leavingSoon, savedSoon } from "../app/src/lib/friends";
import { closeBy, planAhead, planDirectionsUrl, planFromShorts, planMessage, planNight } from "../app/src/lib/plan";
import { newSince } from "../app/src/lib/fresh";
import { pitchEmail } from "../app/src/lib/pitch";
import { calendarUrl } from "../app/src/lib/calendar";
import { matchesQuery, parseQuery, priceOf, rankByVenue } from "../app/src/lib/search";

const spot = (over: Partial<Spot>): Spot => ({
  id: "s", city: "new york, ny", title: "Jazz", venue: "Nublu", address: "151 Avenue C", start: null, category: "music",
  price: null, deal: null, description: "", url: null, lat: 40.7225, lng: -73.9798, confidence: "medium", source: "exa",
  ...over,
} as Spot);

// Local 9pm on Friday Nov 6 2026. Labels use the machine's local time, so build times locally too.
const FRI_9PM = new Date(2026, 10, 6, 21, 0, 0).getTime();
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0, 0).toISOString();
const withTime = (fn: () => void) => () => {
  const t = new FakeTime(FRI_9PM);
  try { fn(); } finally { t.restore(); }
};

Deno.test("time: deals and happy hours are recurring", () => {
  expect(isRecurring(spot({ category: "deal" }))).toBe(true);
  expect(isRecurring(spot({ title: "Happy Hour" }))).toBe(true);
  expect(isRecurring(spot({ title: "Jazz trio" }))).toBe(false);
});

Deno.test("time: a 1am set still reads Tonight; the next evening reads Tomorrow", withTime(() => {
  expect(whenLabel(spot({ start: at(7, 1) }))).toMatch(/^Tonight · /);
  expect(whenLabel(spot({ start: at(6, 23) }))).toMatch(/^Tonight · /);
  expect(whenLabel(spot({ start: at(7, 20) }))).toMatch(/^Tomorrow · /);
  expect(whenLabel(spot({ start: null }))).toBe("Ongoing");
  expect(whenLabel(spot({ title: "Happy hour", start: at(9, 17) }))).toBe("Happy hour");
}));

Deno.test("time: the night ends at 6am", withTime(() => {
  expect(nightEnd()).toBe(new Date(2026, 10, 7, 6, 0, 0).getTime());
}));

Deno.test("filters: Tonight is the rest of tonight plus standing deals", withTime(() => {
  expect(matches(spot({ start: at(6, 23) }), "tonight")).toBe(true);
  expect(matches(spot({ start: at(7, 2) }), "tonight")).toBe(true);
  expect(matches(spot({ start: at(7, 20) }), "tonight")).toBe(false);
  expect(matches(spot({ category: "deal" }), "tonight")).toBe(true);
  expect(matches(spot({ start: null }), "tonight")).toBe(false);
}));

Deno.test("filters: categories and All", () => {
  expect(matches(spot({ category: "music" }), "music")).toBe(true);
  expect(matches(spot({ category: "arts" }), "music")).toBe(false);
  expect(matches(spot({}), "all")).toBe(true);
});

Deno.test("filters: Yelo partners first, unconfirmed last, then soonest", withTime(() => {
  const out = sortSpots([
    spot({ id: "late", start: at(7, 1) }),
    spot({ id: "shaky", start: at(6, 22), confidence: "low" }),
    spot({ id: "partner", start: at(8, 21), partner: true }),
    spot({ id: "soon", start: at(6, 22) }),
  ]);
  expect(out.map((e) => e.id)).toEqual(["partner", "soon", "late", "shaky"]);
}));

Deno.test("clusters: close spots group at this zoom, far ones stay apart", () => {
  const region = { latitude: 40.72, longitude: -73.99, latitudeDelta: 0.09, longitudeDelta: 0.09 };
  const out = clusterEvents([spot({ id: "a" }), spot({ id: "b", lat: 40.7226, lng: -73.9799 }), spot({ id: "c", lat: 40.78, lng: -73.95 })], region);
  expect(out).toHaveLength(2);
  expect(out.map((c) => c.events.length).sort()).toEqual([1, 2]);
});

Deno.test("clusters: coreOf drops a stray pin so the map doesn't zoom out for it", () => {
  const pts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => spot({ id: `p${i}`, lat: 40.72 + i * 0.001 }));
  const core = coreOf([...pts, spot({ id: "far", lat: 41.5 })]);
  expect(core.find((e) => e.id === "far")).toBeUndefined();
  expect(core.length).toBeGreaterThanOrEqual(6);
});

Deno.test("fare: distance, the Yelo discount, and no price across cities", () => {
  const nublu = { lat: 40.7225, lng: -73.9798 }, empire = { lat: 40.7484, lng: -73.9857 };
  expect(km(nublu, empire)).toBeGreaterThan(2.8);
  expect(km(nublu, empire)).toBeLessThan(3.0);
  const f = estimateFare(nublu, empire)!;
  expect(f.yelo).toBeLessThan(f.typical);
  expect(f.typical).toBeGreaterThanOrEqual(9);
  expect(estimateFare(nublu, { lat: 34.05, lng: -118.24 })).toBeNull();
});

Deno.test("cities: aliases fold (must match supabase/functions/_shared/cities.ts)", () => {
  expect(canonicalCity("nyc")).toBe("New York, NY");
  expect(canonicalCity("Brooklyn")).toBe("New York, NY");
  expect(canonicalCity("weho")).toBe("Los Angeles, CA");
  expect(cityKey("L.A.")).toBe("los angeles, ca");
});

Deno.test("fresh: New means first found in the last 24 hours", async () => {
  const { isNew } = await import("../app/src/lib/fresh.ts");
  const now = Date.parse("2026-11-06T22:00:00Z");
  expect(isNew(spot({ discovered_at: "2026-11-06T10:00:00Z" }), now)).toBe(true);
  expect(isNew(spot({ discovered_at: "2026-11-05T20:00:00Z" }), now)).toBe(false);
  expect(isNew(spot({}), now)).toBe(false);
});

Deno.test("similar catches a price that repeats the title", () => {
  expect(similar("$4 Yuengling Drafts & Shots", "$4 Yuengling Drafts & Shots all night")).toBe(true);
  expect(similar("$20", "Jazz at Nublu")).toBe(false);
});

Deno.test("times read in the city on the map, whatever the phone's zone", () => {
  const t = new FakeTime(new Date("2026-11-07T01:00:00Z")); // 8 PM in New York, 5 PM in LA
  try {
    const show = { start: "2026-11-07T03:00:00Z", category: "music", title: "Set", deal: null } as never;
    setCityZone("Los Angeles, CA");
    expect(clock(new Date("2026-11-07T03:00:00Z"))).toBe("7 PM");
    expect(whenLabel(show)).toBe("Tonight · 7:00 PM");
    // The LA night ends at 6am LA time (14:00 UTC), not 6am New York time.
    expect(new Date(nightEnd()).toISOString()).toBe("2026-11-07T14:00:00.000Z");
    setCityZone("New York, NY");
    expect(clock(new Date("2026-11-07T03:00:00Z"))).toBe("10 PM");
    expect(new Date(nightEnd()).toISOString()).toBe("2026-11-07T11:00:00.000Z");
  } finally { setCityZone(null); t.restore(); }
});

Deno.test("leaving after midnight on the same night out has no day prefix", () => {
  const t = new FakeTime(new Date("2026-11-07T04:58:00Z")); // Fri 11:58 PM in New York
  try {
    setCityZone("New York, NY");
    expect(otherDayPrefix(new Date("2026-11-07T05:58:00Z"))).toBe(""); // Sat 12:58 AM: still Friday night
    expect(otherDayPrefix(new Date("2026-11-08T01:00:00Z"))).toBe("Sat "); // Sat 8 PM: the next night
  } finally { setCityZone(null); t.restore(); }
});

Deno.test("goingLine names your crew, then counts everyone else", () => {
  expect(goingLine(0)).toBe(null);
  expect(goingLine(4)).toBe("4 going");
  expect(goingLine(2, { others: ["Maya"], me: true })).toBe("Maya and you");
  expect(goingLine(5, { others: ["Maya"], me: true })).toBe("Maya and you · 3 more");
  expect(goingLine(1, { others: ["Maya"], me: false })).toBe("Maya");
  expect(goingLine(4, { others: ["Maya", "Jo", "Sam"], me: true })).toBe("Maya, Jo and you · 1 more");
  expect(goingLine(0, { others: ["Maya"], me: false })).toBe("Maya"); // count not refreshed yet
});

Deno.test("late in the night: started sets say so and sort after ones to come", () => {
  const t = new FakeTime(new Date("2026-11-07T06:20:00Z")); // 1:20 AM in New York
  try {
    setCityZone("New York, NY");
    const early = { id: "a", start: "2026-11-07T03:30:00Z", category: "nightlife", title: "Set", deal: null } as unknown as Spot; // 10:30 PM
    const late = { id: "b", start: "2026-11-07T06:30:00Z", category: "nightlife", title: "Set", deal: null } as unknown as Spot;  // 1:30 AM
    expect(whenLabel(early as never)).toBe("Started · 10:30 PM");
    expect(whenLabel(late as never)).toBe("Tonight · 1:30 AM");
    expect(sortSpots([early, late]).map((e) => e.id)).toEqual(["b", "a"]);
    const deal = { id: "c", start: null, category: "deal", title: "Happy hour", deal: "Half off" } as unknown as Spot;
    expect(sortSpots([deal, early]).map((e) => e.id)).toEqual(["a", "c"]); // a set under way beats a standing deal
  } finally { setCityZone(null); t.restore(); }
});

Deno.test("a partner's standing deal doesn't lead dated events", () => {
  const t = new FakeTime(new Date("2026-11-07T06:47:00Z")); // 10:47 PM in LA
  try {
    const hh = { id: "hh", start: null, category: "deal", title: "Happy hour", deal: "3-7 PM", partner: true } as unknown as Spot;
    const set = { id: "set", start: "2026-11-07T07:30:00Z", category: "music", title: "Set", deal: null, partner: false } as unknown as Spot;
    const pset = { id: "pset", start: "2026-11-07T08:00:00Z", category: "music", title: "Set", deal: null, partner: true } as unknown as Spot;
    expect(sortSpots([hh, set, pset]).map((e) => e.id)).toEqual(["pset", "set", "hh"]);
  } finally { t.restore(); }
});

Deno.test("initials: first letter of each word, at most two", () => {
  expect(initials("Maya")).toBe("M");
  expect(initials("maya lin")).toBe("ML");
  expect(initials("  Ana Maria Lopez ")).toBe("AM");
});

Deno.test("search: every word must match, with aliases and a price cap", () => {
  const jazz = { venue: "Smalls", title: "Late jazz jam", description: "", deal: null, price: "$25", address: "183 W 10th St, New York", category: "music" } as unknown as Spot;
  const club = { venue: "Elsewhere", title: "AEREA", description: "Techno till 3am", deal: "Free before 11pm", price: "$21+", address: "599 Johnson Ave, Brooklyn", category: "nightlife" } as unknown as Spot;
  const m = (q: string, e: Spot) => matchesQuery(e, parseQuery(q));
  expect(m("jazz", jazz)).toBe(true);
  expect(m("jazz brooklyn", jazz)).toBe(false);     // both words must match
  expect(m("dance", club)).toBe(true);              // alias: techno
  expect(m("free", club)).toBe(true);
  expect(m("Brooklyn", club)).toBe(true);           // case-insensitive, address counts
  expect(m("under $20", jazz)).toBe(false);         // $25
  expect(m("under 20", club)).toBe(true);           // free entry counts as 0
  expect(priceOf({ price: null, deal: null } as never)).toBe(null);
  expect(m("", jazz)).toBe(true);
});

Deno.test("search ranks the named venue first, otherwise keeps order", () => {
  const a = { venue: "Blue Note" }, b = { venue: "Nublu" }, c = { venue: "Smalls" };
  expect(rankByVenue([a, b, c], parseQuery("nublu")).map((e) => e.venue)).toEqual(["Nublu", "Blue Note", "Smalls"]);
  expect(rankByVenue([a, b, c], parseQuery("jazz")).map((e) => e.venue)).toEqual(["Blue Note", "Nublu", "Smalls"]);
});

Deno.test("daytime starts read Today, evening ones Tonight", () => {
  const t = new FakeTime(new Date("2026-11-07T13:30:00Z")); // 8:30 AM in New York
  try {
    setCityZone("New York, NY");
    const at = (iso: string) => ({ start: iso, category: "community", title: "x", deal: null }) as never;
    expect(whenLabel(at("2026-11-07T15:00:00Z"))).toBe("Today · 10:00 AM");
    expect(whenLabel(at("2026-11-08T00:00:00Z"))).toBe("Tonight · 7:00 PM");
    expect(whenLabel(at("2026-11-08T06:00:00Z"))).toBe("Tonight · 1:00 AM"); // after midnight, same night
  } finally { setCityZone(null); t.restore(); }
});

Deno.test("happy hour status comes from the listing's own hours", () => {
  expect(dealHours("Happy Hour 3-7pm: $5 beers")).toEqual({ from: 900, to: 1140 });
  expect(dealHours("Daily 4 to 6:30 PM")).toEqual({ from: 960, to: 1110 });
  expect(dealHours("Late night 11-2am")).toEqual({ from: 1380, to: 120 });
  expect(dealHours("Half off all drinks")).toBe(null);
  const hh = { title: "Happy hour", deal: "Happy Hour 3-7pm" };
  setCityZone("New York, NY");
  try {
    expect(dealStatus(hh, Date.parse("2026-11-07T17:00:00Z"))).toBe("From 3 PM");      // noon
    expect(dealStatus(hh, Date.parse("2026-11-07T22:30:00Z"))).toBe("On until 7 PM");  // 5:30 PM
    expect(dealStatus(hh, Date.parse("2026-11-08T01:00:00Z"))).toBe(null);             // 8 PM
    expect(dealStatus({ title: "Late", deal: "11-2am" }, Date.parse("2026-11-08T06:00:00Z"))).toBe("On until 2 AM"); // 1 AM
  } finally { setCityZone(null); }
});

Deno.test("deals: on now first, then soonest, then over or unknown", () => {
  const t = new FakeTime(new Date("2026-11-07T22:30:00Z")); // 5:30 PM in New York
  try {
    setCityZone("New York, NY");
    const d = (id: string, deal: string) => ({ id, start: null, category: "deal", title: "Happy hour", deal, partner: id === "none" }) as unknown as Spot;
    const out = sortSpots([d("none", "Half off"), d("later", "Happy hour 6-8pm"), d("now", "Happy hour 4-7pm"), d("over", "Happy hour 2-4pm")]);
    expect(out.map((e) => e.id)).toEqual(["now", "later", "none", "over"]);
  } finally { setCityZone(null); t.restore(); }
});

Deno.test("newSince counts spots first found after the last visit", () => {
  const at = (id: string, d: string | null) => ({ id, discovered_at: d }) as unknown as Spot;
  const list = [at("a", "2026-11-07T10:00:00Z"), at("b", "2026-11-07T15:00:00Z"), at("c", null)];
  expect(newSince(list, Date.parse("2026-11-07T12:00:00Z")).map((e) => e.id)).toEqual(["b"]);
});

Deno.test("pitch email uses what Scout knows about the room", () => {
  const p = pitchEmail({ venue: "Pete's Candy Store", quietNight: "Monday", capacity: "Up to 125" }, "New York, NY", 3);
  expect(p.subject).toBe("A Yelo night at Pete's Candy Store");
  expect(p.body).toContain("(up to 125 people)");
  expect(p.body).toContain("Mondays could be a good night to start");
  expect(p.body).toContain("3 times this week");
  expect(pitchEmail({ venue: "X", quietNight: null, capacity: null }, "Los Angeles, CA").body).not.toContain("Scout, our discovery app");
});

Deno.test("calendar link carries title, time and place; none without a start", () => {
  const u = calendarUrl({ venue: "Nublu", title: "Late set", start: "2026-11-08T03:00:00Z", address: "151 Avenue C, New York, NY", url: "" })!;
  const q = new URL(u).searchParams;
  expect(q.get("text")).toBe("Late set at Nublu");
  expect(q.get("dates")).toBe("20261108T030000Z/20261108T060000Z");
  expect(q.get("location")).toBe("Nublu, 151 Avenue C, New York, NY");
  expect(calendarUrl({ venue: "X", title: "y", start: null, address: "", url: "" })).toBe(null);
});

Deno.test("search understands tonight, tomorrow and the weekend", () => {
  setCityZone("New York, NY");
  try {
    const now = Date.parse("2026-11-07T18:00:00Z"); // Sat 1 PM in New York
    const at = (start: string | null, category = "music") => ({ venue: "V", title: "Jazz set", description: "", deal: null, price: null, address: "", category, start }) as unknown as Spot;
    const sat = at("2026-11-08T01:00:00Z"), sun = at("2026-11-09T01:00:00Z"), tue = at("2026-11-11T01:00:00Z");
    const hh = at(null, "deal");
    const q = (t: string) => parseQuery(t);
    expect(q("jazz tomorrow").when).toBe("tomorrow");
    expect(q("jazz tomorrow").words).toEqual(["jazz"]);
    expect(matchesQuery(sat, q("jazz tonight"), now)).toBe(true);
    expect(matchesQuery(sun, q("jazz tonight"), now)).toBe(false);
    expect(matchesQuery(sun, q("tomorrow"), now)).toBe(true);
    expect(matchesQuery(tue, q("this weekend"), now)).toBe(false);
    expect(matchesQuery(sun, q("this weekend"), now)).toBe(true);
    const nextFri = at("2026-11-14T00:00:00Z"); // Fri Nov 13, 7 PM
    expect(matchesQuery(nextFri, q("this weekend"), now)).toBe(false); // on a Saturday, next Friday isn't this weekend
    expect(matchesQuery(nextFri, q("this weekend"), Date.parse("2026-11-10T18:00:00Z"))).toBe(true); // from Tuesday it is
    expect(matchesQuery(hh, q("tomorrow"), now)).toBe(true); // standing deals fit any day
  } finally { setCityZone(null); }
});

Deno.test("leavingSoon: soonest crew you haven't left for, within 45 min", () => {
  const now = Date.parse("2026-11-07T23:00:00Z");
  const at = (m: number) => new Date(now + m * 60000).toISOString();
  const crew = (venue: string, m: number, status = "in") => ({ venue, leaveAt: at(m), members: [{ me: true, status }, { me: false, status: "in" }] });
  expect(leavingSoon([crew("Nublu", 30), crew("Elsewhere", 18)], now)).toEqual({ crew: crew("Elsewhere", 18), mins: 18 });
  expect(leavingSoon([crew("Nublu", 18, "on_way")], now)).toBeNull(); // already on the way
  expect(leavingSoon([crew("Nublu", 60)], now)).toBeNull(); // too far off
  expect(leavingSoon([crew("Nublu", -5)], now)?.mins).toBe(-5); // just past: still nudging
  expect(leavingSoon([crew("Nublu", -15)], now)).toBeNull(); // long past
  expect(leavingSoon([{ venue: "X", leaveAt: at(10), members: [{ me: false, status: "in" }] }], now)).toBeNull(); // not your crew
});

Deno.test("planNight: happy hour now, a show close by later, then somewhere late", () => {
  setCityZone("New York, NY");
  const now = Date.parse("2026-11-07T22:30:00Z"); // 5:30 PM in New York
  const at = (h: number) => new Date(Date.parse("2026-11-07T05:00:00Z") + h * 3600e3).toISOString(); // h o'clock NY, that day
  const base = { address: "", price: null, deal: null, description: "", url: null, confidence: "high" as const, source: "exa" as const };
  const spot = (id: string, venue: string, category: Spot["category"], start: string | null, lat: number, extra: Partial<Spot> = {}): Spot =>
    ({ ...base, id, title: venue, venue, category, start, lat, lng: -73.98, ...extra });
  const hh = spot("hh", "Bar A", "deal", null, 40.72, { deal: "Happy Hour 4-7pm" });
  const show = spot("show", "Club B", "music", at(20), 40.724);
  const far = spot("far", "Far C", "music", at(20.25), 40.85);
  const late = spot("late", "Room D", "nightlife", at(23), 40.728);
  const shaky = spot("shaky", "Maybe E", "nightlife", at(22), 40.721, { confidence: "low" });
  const plan = planNight([late, far, show, hh, shaky], now);
  expect(plan.map((p) => p.spot.id)).toEqual(["hh", "show", "late"]);
  expect(plan.map((p) => p.step)).toEqual(["Start here", "Then", "Late"]);
  expect(plan[0].hop).toBeNull();
  expect(plan[1].hop).toBe("a short walk");
  // Nothing to chain: a single spot is not a plan.
  expect(planNight([show], now)).toEqual([]);
  // Browsing another city: the rider's own location (here, Los Angeles) is ignored, not a 4 km leash.
  expect(planNight([late, show, hh], now, { lat: 34.05, lng: -118.25 }).map((p) => p.spot.id)).toEqual(["hh", "show", "late"]);
  // An isolated first pick (a partner happy hour far from everything) no longer sinks the plan:
  // the next opener that leads somewhere is used.
  const lonely = spot("lonely", "Far Bar", "deal", null, 40.9, { deal: "Happy Hour 4-7pm", partner: true });
  expect(planNight([lonely, hh, show, late], now).map((p) => p.spot.id)).toEqual(["hh", "show", "late"]);
  // A third stop at 8:30 PM is "Then", not "Late".
  const early = spot("early", "Club F", "music", at(18.5), 40.724), evening = spot("evening", "Room G", "nightlife", at(20.5), 40.726);
  expect(planNight([hh, early, evening], now).map((p) => p.step)).toEqual(["Start here", "Then", "Then"]);
  // As a text to friends: each stop with its time and link.
  const t = new FakeTime(now);
  try {
    const msg = planMessage(plan, (e) => `https://x/${e.id}`);
    expect(msg.split("\n")).toEqual(["Tonight's plan:", "1. Bar A · happy hour, until 7 PM", "https://x/hh",
      "2. Club B · 8 PM", "https://x/show", "3. Room D · 11 PM", "https://x/late"]);
    // With a whole-plan link: stops without links, the one link last.
    expect(planMessage(plan, (e) => `https://x/${e.id}`, "https://x/p").split("\n")).toEqual(["Tonight's plan:",
      "1. Bar A · happy hour, until 7 PM", "2. Club B · 8 PM", "3. Room D · 11 PM", "https://x/p"]);
    // Shouting titles calmed, a billing that names the venue kept, a deal without hours says what it is.
    const loud = spot("loud", "Nublu", "music", at(20), 40.724, { title: "NUBLU PRESENTS JAZZ NIGHT" });
    const deal = spot("deal", "Bar H", "deal", null, 40.72, { title: "Bar H Specials", deal: "$5 drafts all night" });
    const m2 = planMessage([{ spot: deal, step: "Start here", hop: null }, { spot: loud, step: "Then", hop: null }], () => "L").split("\n");
    expect(m2[1]).toBe("1. Bar H · $5 drafts all night");
    expect(m2[3]).toMatch(/^2\. Nublu · 8 PM, Nublu Presents Jazz Night$/);
  } finally { t.restore(); }
  setCityZone(null);
});

Deno.test("shortTitle never ends on a joiner", () => {
  expect(shortTitle("Reggaeton on Houston – Latin & Caribbean Nights", 40)).toBe("Reggaeton on Houston – Latin…");
  expect(shortTitle("Short title")).toBe("Short title");
});

Deno.test("inviteBill: shared messages never repeat the venue or the time", () => {
  expect(inviteBill("Nublu", "Nublu")).toBe("");
  expect(inviteBill("Happy Hour", "Rocco's Tavern")).toBe("");
  expect(inviteBill("JAZZ NIGHT WITH THE COUNCIL", "Nublu")).toBe("Jazz Night with the Council");
  const long = inviteBill("Producer Mondays with Ray Angry & The Council of Elders and Friends", "Nublu");
  expect(long.endsWith("…")).toBe(true);
  expect(long.length).toBeLessThanOrEqual(49);
  expect(withBill("Come to Nublu tonight at 8 PM", "Jazz Night")).toBe("Come to Nublu tonight at 8 PM: Jazz Night.");
  expect(withBill("Come to Nublu tonight at 8 PM", "")).toBe("Come to Nublu tonight at 8 PM.");
  expect(withBill("Come to Nublu tonight at 8 PM", long)).not.toContain("….");
});

// React Native crashes on raw text inside a View ("Text strings must be rendered within a <Text>").
// The easy way to make one: an element and a JSX comment on the same line ("<Icon /> {/* why */}"):
// the space between them becomes a text node. #58 shipped exactly that; this keeps it from coming back.
Deno.test("no element followed by a same-line JSX comment", async () => {
  const bad: string[] = [];
  async function walk(dir: string) {
    for await (const f of Deno.readDir(dir)) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory) await walk(p);
      else if (p.endsWith(".tsx")) (await Deno.readTextFile(p)).split("\n").forEach((line, i) => {
        if (/(\/>|<\/[\w.]+>)[ \t]+\{\/\*/.test(line)) bad.push(`${p}:${i + 1}`);
      });
    }
  }
  await walk(new URL("../app/src", import.meta.url).pathname);
  expect(bad).toEqual([]);
});

Deno.test("deal hours come from the happy-hour clause, on its days", () => {
  setCityZone("Los Angeles, CA");
  try {
    // Mattie's, LA: the hours after the semicolon are Saturday opening hours, not a happy hour.
    const mattie = { title: "West Hollywood — Happy Hour & Nightlife", deal: "Happy Hour Tue-Fri open-7pm; Saturday open 12pm-4am with drag brunch and DJ sets" };
    const sat2pm = Date.parse("2026-11-07T22:00:00Z"), fri5pm = Date.parse("2026-11-07T01:00:00Z");
    expect(dealHours(`${mattie.deal} ${mattie.title}`)).toBe(null);
    expect(dealStatus(mattie, sat2pm)).toBe(null);
    // Named days are respected; "Sunset" isn't Sunday.
    const wk = { title: "Happy Hour", deal: "Happy hour Mon-Fri 4-7pm" };
    expect(dealStatus(wk, sat2pm)).toBe(null);
    expect(dealStatus(wk, fri5pm)).toBe("On until 7 PM");
    expect(dealDays("Sunset happy hour 5-7pm")).toBe(null);
    expect(dealHours("Happy hour $5.50 wells 4-7pm")).toEqual({ from: 960, to: 1140 }); // a "." inside the clause doesn't split it
    expect([...dealDays("Happy hour weekdays 3-6pm")!]).toEqual([1, 2, 3, 4, 5]);
    expect([...dealDays("Happy hour Sat & Sun 2-9PM")!].sort()).toEqual([0, 6]);
    expect([...dealDays("Happy Hour Fri-Mon 3-6")!].sort()).toEqual([0, 1, 5, 6]);
  } finally { setCityZone(null); }
});

Deno.test("goingLine: going on your own says you", () => {
  expect(goingLine(3, { others: [], me: true })).toBe("You and 2 more");
  expect(goingLine(1, { others: [], me: true })).toBe("You're going");
  expect(goingLine(4)).toBe("4 going");
});

Deno.test("milesLabel: no 0.0 mi", () => {
  expect(milesLabel(0.02)).toBe("Under 0.1 mi");
  expect(milesLabel(0.4)).toBe("0.4 mi");
  expect(milesLabel(2.6)).toBe("3 mi");
});

Deno.test("planAhead: tonight's plan, else tomorrow evening's, marked as such", () => {
  setCityZone("New York, NY");
  try {
    const late = Date.parse("2026-11-08T07:30:00Z"); // 2:30 AM Sunday in New York: tonight is over
    // 6 PM tomorrow in New York: the night of Sat→Sun counts as "tonight" until 6 AM, so tomorrow is Sunday.
    expect(new Date(eveningAfter(late)).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    const base = { address: "", price: null, deal: null, description: "", url: null, confidence: "high" as const, source: "exa" as const, lng: -73.98 };
    const at = (iso: string) => iso;
    const a = { ...base, id: "a", title: "A", venue: "Club A", category: "music" as const, start: at("2026-11-09T00:00:00Z"), lat: 40.724 }; // Sun 7 PM
    const b = { ...base, id: "b", title: "B", venue: "Room B", category: "nightlife" as const, start: at("2026-11-09T03:00:00Z"), lat: 40.726 }; // Sun 10 PM
    const plan = planAhead([a, b], late);
    expect(plan.map((p) => [p.spot.id, p.day])).toEqual([["a", "Tomorrow"], ["b", "Tomorrow"]]);
    expect(planMessage(plan, () => "L", "W").split("\n")[0]).toBe("Tomorrow's plan:");
  } finally { setCityZone(null); }
});

Deno.test("planFromShorts: a friend's plan, in their order", () => {
  setCityZone("New York, NY");
  try {
    const now = Date.parse("2026-11-07T22:30:00Z"); // 5:30 PM
    const base = { address: "", price: null, description: "", url: null, confidence: "high" as const, source: "exa" as const, lng: -73.98 };
    const hh = { ...base, id: "hh", short: "aaaa1111", title: "Happy Hour", venue: "Bar A", category: "deal" as const, start: null, deal: "Happy Hour 4-7pm", lat: 40.72 };
    const set = { ...base, id: "s", short: "bbbb2222", title: "Set", venue: "Club B", category: "music" as const, start: "2026-11-08T01:00:00Z", deal: null, lat: 40.724 };
    const late = { ...base, id: "l", short: "cccc3333", title: "Late", venue: "Room C", category: "nightlife" as const, start: "2026-11-08T04:00:00Z", deal: null, lat: 40.75 };
    const p = planFromShorts([late, set, hh], ["aaaa1111", "bbbb2222", "cccc3333"], now);
    expect(p.map((s) => [s.spot.id, s.step])).toEqual([["hh", "Start here"], ["s", "Then"], ["l", "Late"]]);
    expect(p[1].hop).toBe("a short walk");
    expect(p[2].hop).toBe("1.8 mi");
    expect(planFromShorts([hh, set], ["aaaa1111", "zzzz9999"], now)).toEqual([]); // one stop left isn't a plan
  } finally { setCityZone(null); }
});

Deno.test("parseQuery: 'near me' is a place to filter by, not words", () => {
  expect(parseQuery("jazz near me")).toEqual({ words: ["jazz"], maxPrice: null, when: null, near: true });
  expect(parseQuery("free drinks nearby tonight").near).toBe(true);
  expect(parseQuery("free drinks nearby tonight").words).toEqual(["free", "drinks"]);
  expect(parseQuery("Close By").near).toBe(true);
  expect(parseQuery("nearly famous").near).toBe(false); // a band name isn't "near me"
});

Deno.test("savedSoon: the soonest saved spot starting within 45 min", () => {
  const now = Date.parse("2026-11-08T00:00:00Z");
  const at = (m: number) => new Date(now + m * 60000).toISOString();
  const s = (id: string, m: number | null, extra = {}) => ({ id, start: m === null ? null : at(m), category: "music", title: "Set", deal: null, ...extra });
  const saved = new Set(["a", "b", "c", "d"]);
  expect(savedSoon([s("a", 40), s("b", 25), s("x", 5)], saved, now)?.spot.id).toBe("b"); // x isn't saved
  expect(savedSoon([s("c", 60)], saved, now)).toBeNull(); // too far off
  expect(savedSoon([s("d", -5)], saved, now)).toBeNull(); // already started
  expect(savedSoon([s("a", 10, { category: "deal" })], saved, now)).toBeNull(); // deals don't start
});

Deno.test("parseQuery/matchesQuery: 'after 10' and 'late' are a starting hour", () => {
  expect(parseQuery("jazz after 10").after).toBe(22);
  expect(parseQuery("jazz after 10").words).toEqual(["jazz"]);
  expect(parseQuery("after 9:30pm").after).toBe(21);
  expect(parseQuery("brunch after 11am").after).toBe(11);
  expect(parseQuery("techno late night").after).toBe(22);
  expect(parseQuery("late").words).toEqual([]);
  expect(parseQuery("after 12").after).toBe(0);
  expect(parseQuery("techno after 1").after).toBe(1); // 1 AM, not 1 PM
  expect(parseQuery("after 1pm").after).toBe(13);
  setCityZone("New York, NY");
  try {
    const at = (iso: string) => ({ id: iso, title: "Set", venue: "V", address: "", start: iso, category: "music", price: null, deal: null, description: "", url: null, lat: 0, lng: 0, confidence: "high", source: "exa" }) as unknown as Spot;
    const q = parseQuery("late");
    expect(matchesQuery(at("2026-11-08T03:30:00Z"), q)).toBe(true);  // 10:30 PM
    expect(matchesQuery(at("2026-11-08T06:00:00Z"), q)).toBe(true);  // 1 AM: still late
    expect(matchesQuery(at("2026-11-08T00:00:00Z"), q)).toBe(false); // 7 PM
    const one = parseQuery("after 1");
    expect(matchesQuery(at("2026-11-08T06:30:00Z"), one)).toBe(true);  // 1:30 AM
    expect(matchesQuery(at("2026-11-08T00:00:00Z"), one)).toBe(false); // 7 PM isn't "after 1"
    const brunch = parseQuery("after 11am");
    expect(matchesQuery(at("2026-11-07T17:00:00Z"), brunch)).toBe(true); // noon
    const hh = { ...at("2026-11-08T03:30:00Z"), category: "deal", title: "Happy hour" } as Spot;
    expect(matchesQuery(hh, q)).toBe(false); // standing deals have no start to compare
  } finally { setCityZone(null); }
});

Deno.test("closeBy: nearest three, same night, one per venue, in time order", () => {
  setCityZone("New York, NY");
  try {
    const now = Date.parse("2026-11-07T23:00:00Z"); // 6 PM
    const base = { address: "", price: null, deal: null, description: "", url: null, confidence: "high" as const, source: "exa" as const, lng: -73.98, category: "music" as const };
    const s = (id: string, venue: string, start: string | null, lat: number, extra = {}) => ({ ...base, id, title: id, venue, start, lat, ...extra }) as Spot;
    const here = s("here", "Nublu", "2026-11-08T00:00:00Z", 40.72);
    const list = [here,
      s("a", "Drom", "2026-11-08T02:30:00Z", 40.722),            // 9:30 PM, near
      s("b", "Caveat", "2026-11-08T00:00:00Z", 40.724),          // 7 PM, near
      s("b2", "Caveat", "2026-11-08T03:00:00Z", 40.7241),        // same venue: one row
      s("c", "Studio 151", "2026-11-08T01:00:00Z", 40.721),      // 8 PM, nearest
      s("d", "Far Hall", "2026-11-08T01:00:00Z", 40.80),         // too far
      s("e", "Tomorrow Club", "2026-11-09T00:00:00Z", 40.7205),  // another night
      s("f", "Bar HH", "2026-11-07T21:00:00Z", 40.7202, { category: "deal", title: "Happy hour" }), // standing deal
      s("g", "Nublu", "2026-11-08T03:00:00Z", 40.72)];           // same venue as here
    expect(closeBy(here, list, now).map((e) => e.id)).toEqual(["b", "c", "a"]);
  } finally { setCityZone(null); }
});

Deno.test("planDirectionsUrl: every stop in order, from here (path form)", () => {
  const st = (venue: string, address: string) => ({ spot: { venue, address } as Spot });
  const u = new URL(planDirectionsUrl([st("Tile Bar", "7th St"), st("Blind Barber", "339 E 10th St"), st("Night Club 101", "101 Avenue A")])!);
  expect(u.pathname.split("/").slice(3).map(decodeURIComponent)).toEqual(["", "Tile Bar, 7th St", "Blind Barber, 339 E 10th St", "Night Club 101, 101 Avenue A"]);
  expect(planDirectionsUrl([st("Solo", "1 St")])).toBeNull();
});

Deno.test("parseQuery/matchesQuery: weekday names mean that night this week", () => {
  expect(parseQuery("jazz friday").weekday).toBe(5);
  expect(parseQuery("jazz friday").words).toEqual(["jazz"]);
  expect(parseQuery("techno on saturday").weekday).toBe(6);
  expect(parseQuery("Sundays").weekday).toBe(0);
  setCityZone("New York, NY");
  try {
    const now = Date.parse("2026-11-07T22:00:00Z"); // Sat 5 PM
    const at = (iso: string) => ({ id: iso, title: "Set", venue: "V", address: "", start: iso, category: "music", price: null, deal: null, description: "", url: null, lat: 0, lng: 0, confidence: "high", source: "exa" }) as unknown as Spot;
    const fri = parseQuery("friday");
    expect(matchesQuery(at("2026-11-14T01:00:00Z"), fri, now)).toBe(true);  // Fri Nov 13, 8 PM
    expect(matchesQuery(at("2026-11-14T06:00:00Z"), fri, now)).toBe(true);  // Sat 1 AM: still Friday night
    expect(matchesQuery(at("2026-11-15T01:00:00Z"), fri, now)).toBe(false); // Saturday
    expect(matchesQuery(at("2026-11-21T01:00:00Z"), fri, now)).toBe(false); // the Friday after next week
    expect(matchesQuery(at("2026-11-08T01:00:00Z"), parseQuery("saturday"), now)).toBe(true); // tonight
  } finally { setCityZone(null); }
});
