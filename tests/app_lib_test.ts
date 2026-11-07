// Unit tests for the app's pure logic (no React Native imports at runtime).
// Run from the repo root: deno test --unstable-sloppy-imports --no-check tests/
// (Deno, like the function tests, so there's no extra test dependency in the app.)
import { expect } from "jsr:@std/expect@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import type { Spot } from "../app/src/lib/types";
import { clock, isRecurring, nightEnd, otherDayPrefix, setCityZone, whenLabel } from "../app/src/lib/time";
import { matches, sortSpots } from "../app/src/lib/filters";
import { clusterEvents, coreOf } from "../app/src/lib/cluster";
import { estimateFare, km } from "../app/src/lib/fare";
import { canonicalCity, cityKey } from "../app/src/lib/cities";
import { similar } from "../app/src/lib/case";
import { goingLine } from "../app/src/lib/friends";

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
