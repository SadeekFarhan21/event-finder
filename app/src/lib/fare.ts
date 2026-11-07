// Rough ride estimate from straight-line distance. Not a quote: Yelo's own pricing isn't public,
// so this models a typical city rideshare fare and applies the 25% saving Yelo advertises
// ("Ride 20-30% cheaper" on its App Store page).

export type Point = { lat: number; lng: number };

const ROAD_FACTOR = 1.3; // streets are longer than a straight line
const YELO_DISCOUNT = 0.25;

export function km(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export type Fare = { miles: number; minutes: number; yelo: number; typical: number };

export function estimateFare(from: Point, to: Point): Fare | null {
  const miles = (km(from, to) * ROAD_FACTOR) / 1.609;
  if (miles > 40) return null; // not in the same city; no point pricing it
  const minutes = Math.round(4 + miles * 3.5); // city traffic, ~17 mph
  // Base + booking fee, per mile, per minute; floor at a typical minimum fare.
  const typical = Math.max(9, 5.5 + 1.9 * miles + 0.4 * minutes);
  return { miles, minutes, typical: Math.round(typical), yelo: Math.round(typical * (1 - YELO_DISCOUNT)) };
}

// Distance as people say it: "0.4 mi", "3 mi", and "Under 0.1 mi" right next door ("0.0 mi" read as a glitch).
export const milesLabel = (m: number) => (m < 0.05 ? "Under 0.1 mi" : m < 0.95 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`);
