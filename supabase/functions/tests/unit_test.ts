// Unit tests for the runtime-agnostic agent code. Run: deno test supabase/functions/tests/unit_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { cleanTitle, cleanVenue, dedupeEvents } from "../_shared/clean.ts";
import { canonicalCity, cityKey } from "../_shared/cities.ts";
import { validDate, type YeloEvent } from "../_shared/discover.ts";
import { describeIssues, errorBody, ScoutRequest } from "../_shared/requests.ts";

const ev = (over: Partial<YeloEvent>): YeloEvent => ({
  id: "x", city: "new york, ny", title: "Jazz", venue: "Nublu", address: "151 Avenue C", start: "2026-11-07T00:00:00Z",
  category: "music", price: null, deal: null, description: "", url: null, image: null, lat: 40.7225, lng: -73.9798,
  confidence: "medium", source: "exa", discoveredAt: "2026-11-06T02:00:00Z", ...over,
});

Deno.test("cleanVenue drops area notes and second names", () => {
  assertEquals(cleanVenue("Connolly's Pub (Times Square)"), "Connolly's Pub");
  assertEquals(cleanVenue("Dr. Martens Brand Centre, Herald Square"), "Dr. Martens Brand Centre");
  assertEquals(cleanVenue("The Cabinet Mezcal Bar / Miracle on 9th Street"), "The Cabinet Mezcal Bar");
  assertEquals(cleanVenue("Superior Ingredients – The Roof"), "Superior Ingredients");
  assertEquals(cleanVenue("AB"), "AB"); // too short to shorten
});

Deno.test("cleanTitle drops a trailing 'at <venue>' and bracketed notes", () => {
  assertEquals(cleanTitle("Happy Hour at Cubbyhole (Recurring)", "Cubbyhole"), "Happy Hour");
  assertEquals(cleanTitle("Jazz Night [21+]", "Nublu"), "Jazz Night");
  assertEquals(cleanTitle("Live at Leeds tribute", "Nublu"), "Live at Leeds tribute"); // different venue: keep
});

Deno.test("dedupe merges the same room under two names and keeps distinct places", () => {
  const out = dedupeEvents([
    ev({ id: "a", venue: "Nublu", discoveredAt: "2026-11-06T17:00:00Z" }),
    ev({ id: "b", venue: "Nublu 151", lat: 40.7256, lng: -73.9779 }), // same address, pin 370 m off
    ev({ id: "c", venue: "Nublu Classic", address: "62 Avenue C", lat: 40.73, lng: -73.99 }), // different place
    ev({ id: "d", venue: "Bar", lat: 40.72381, lng: -73.97851, address: "1 Main St" }),
    ev({ id: "e", venue: "Bar Lunatico", lat: 40.72381, lng: -73.97851, address: "1 Main St" }), // "bar" is too short a prefix
  ]);
  assertEquals(out.map((e) => e.id).sort(), ["a", "c", "d", "e"]);
});

Deno.test("dedupe keeps the higher-confidence listing and carries a missing deal over", () => {
  const out = dedupeEvents([
    ev({ id: "low", confidence: "low", deal: "$5 beers", discoveredAt: "2026-11-06T18:00:00Z" }),
    ev({ id: "high", confidence: "high" }),
  ]);
  assertEquals(out.length, 1);
  assertEquals(out[0].id, "high");
  assertEquals(out[0].deal, "$5 beers");
});

Deno.test("dedupe keeps two nights at one venue apart", () => {
  const out = dedupeEvents([ev({ id: "fri", start: "2026-11-07T00:00:00Z" }), ev({ id: "sat", start: "2026-11-08T00:00:00Z" })]);
  assertEquals(out.length, 2);
});

Deno.test("canonicalCity folds aliases into one market", () => {
  for (const s of ["nyc", "NYC ", "new york city", "Brooklyn", "manhattan, ny"]) assertEquals(canonicalCity(s), "New York, NY");
  for (const s of ["la", "L.A.", "weho", "santa monica, ca"]) assertEquals(canonicalCity(s), "Los Angeles, CA");
  assertEquals(canonicalCity("  austin   tx "), "austin tx");
  assertEquals(cityKey("NYC"), "new york, ny");
});

Deno.test("validDate reads a local time in the city's zone", () => {
  // 8pm in New York on Nov 7 (EST, UTC-5) is 01:00 UTC on Nov 8.
  assertEquals(validDate("2026-11-07T20:00:00", "New York, NY"), "2026-11-08T01:00:00.000Z");
  assertEquals(validDate("2026-11-07T20:00:00", "Los Angeles, CA"), "2026-11-08T04:00:00.000Z");
  assertEquals(validDate("2026-11-07T20:00:00Z", "New York, NY"), "2026-11-07T20:00:00.000Z"); // explicit zone wins
  assertEquals(validDate("not a date", "New York, NY"), null);
  assertEquals(validDate(undefined, "New York, NY"), null);
});

Deno.test("scout requests are validated", () => {
  assert(ScoutRequest.safeParse({ task: "events", city: "New York, NY" }).success);
  assert(ScoutRequest.safeParse({ task: "events", city: "New York, NY", focus: 3 }).success);
  assert(!ScoutRequest.safeParse({ task: "events", city: "NYC; DROP TABLE events" }).success);
  assert(!ScoutRequest.safeParse({ task: "events", city: "x".repeat(61) }).success);
  assert(!ScoutRequest.safeParse({ task: "events", city: "New York, NY", focus: -1 }).success);
  assert(!ScoutRequest.safeParse({ task: "review", action: "delete" }).success);
  assert(!ScoutRequest.safeParse({ task: "nuke" }).success);
  const bad = ScoutRequest.safeParse({ task: "events", city: "<script>" });
  assert(!bad.success && describeIssues(bad.error).startsWith("city:"));
  assertEquals(errorBody("BUSY", "Try later."), { error: "Try later.", code: "BUSY" });
});
