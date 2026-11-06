// Approved venue submissions -> map spots. A venue gave us its own address, so this is just
// geocoding and shaping; no search. Runtime-agnostic like the rest of _shared.
import { geocodeWith, slug, type Category, type YeloEvent } from "./discover.ts";
import { cleanVenue } from "./clean.ts";
import type { GeoCache } from "./deps.ts";

export type Submission = {
  id: number; city: string; venue: string; address: string; title: string; start: string | null;
  category: Category; deal: string | null; description: string | null; url: string | null;
};

// city is the canonical display name ("New York, NY"); null when the address can't be placed.
export async function submissionToEvent(sub: Submission, city: string, geo: GeoCache, log?: (m: string) => void): Promise<YeloEvent | null> {
  const pt = await geocodeWith(geo, `${sub.venue}, ${sub.address}`, city, log) ?? await geocodeWith(geo, sub.address, city, log);
  if (!pt) return null;
  return {
    id: slug(`${city}-${sub.venue}-${sub.title}-${sub.start ?? ""}`),
    title: sub.title,
    venue: cleanVenue(sub.venue),
    address: sub.address,
    start: sub.start,
    category: sub.category,
    price: null,
    deal: sub.deal,
    description: sub.description ?? "",
    url: sub.url,
    image: null,
    lat: pt.lat,
    lng: pt.lng,
    city,
    confidence: "high", // the venue itself told us, and a person approved it
    source: "venue",
    discoveredAt: new Date().toISOString(),
  };
}
