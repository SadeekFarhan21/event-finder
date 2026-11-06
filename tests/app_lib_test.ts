// Unit tests for the app's pure logic (no React Native imports at runtime).
// Run from the repo root: deno test --unstable-sloppy-imports --no-check tests/
// (Deno, like the function tests, so there's no extra test dependency in the app.)
import { expect } from "jsr:@std/expect@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import type { Spot } from "../app/src/lib/types";
import { isRecurring, nightEnd, whenLabel } from "../app/src/lib/time";
import { matches, sortSpots } from "../app/src/lib/filters";
import { clusterEvents, coreOf } from "../app/src/lib/cluster";
import { estimateFare, km } from "../app/src/lib/fare";
import { canonicalCity, cityKey } from "../app/src/lib/cities";

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
