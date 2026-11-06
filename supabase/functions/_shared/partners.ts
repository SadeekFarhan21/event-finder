// Yelo's current venue partners, as listed on joinyelo.com/partner (Nov 2026).
// Yelo builds nights at these rooms and points its riders at them, so Scout features them.
import { cleanVenue } from "./clean.ts";

// `address` is a geocoding fallback for rooms OpenStreetMap doesn't know by name.
export const PARTNERS: { name: string; city: "new york" | "los angeles"; area?: string; address?: string }[] = [
  { name: "Nublu", city: "new york", area: "East Village" },
  { name: "Rocco's Tavern", city: "los angeles", area: "Westwood" },
  { name: "Baja Sharkeez", city: "los angeles" },
  { name: "Gold-Diggers", city: "los angeles", area: "East Hollywood" },
  { name: "Wonzimer Gallery", city: "los angeles", area: "Lincoln Heights", address: "341 S Avenue 17, Los Angeles, CA" },
  { name: "Mile 44", city: "los angeles" },
  { name: "Killarney's", city: "los angeles" },
  { name: "Creator Space", city: "los angeles", area: "Santa Monica" },
  { name: "The Earl", city: "los angeles", area: "Koreatown" },
];

const key = (s: string) => cleanVenue(s).toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
const KEYS = PARTNERS.map((p) => key(p.name));

const matchIndex = (venue: string) => {
  const k = key(venue);
  return KEYS.findIndex((p) => k === p || (p.length >= 5 && k.startsWith(p)));
};

export const isPartner = (venue: string) => matchIndex(venue) >= 0;
export const partnerAddress = (venue: string) => PARTNERS[matchIndex(venue)]?.address;

export const partnersIn = (city: string) => {
  const c = city.toLowerCase();
  const metro = /new york|nyc|brooklyn|manhattan/.test(c) ? "new york" : /los angeles|\bla\b|santa monica|westwood|hollywood/.test(c) ? "los angeles" : null;
  return PARTNERS.filter((p) => p.city === metro);
};
