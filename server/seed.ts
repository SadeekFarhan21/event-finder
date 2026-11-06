// Demo events (NYC) so the app works before an Exa key is added.
// Times are relative to "today at 8pm" so the demo never looks stale.
import type { YeloEvent } from "../supabase/functions/_shared/discover.ts";

const at = (dayOffset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const base = { city: "new york, ny", source: "demo" as const, confidence: "high" as const, discoveredAt: new Date().toISOString(), url: null };

export const seedEvents = (): YeloEvent[] => [
  { ...base, id: "demo-1", title: "Late-night jazz jam", venue: "Smalls Jazz Club", address: "183 W 10th St, New York, NY", start: at(0, 22), category: "music", price: "$25", deal: null, description: "Open jam that runs past 2am in a tiny basement room.", lat: 40.7343, lng: -74.0027 },
  { ...base, id: "demo-2", title: "Happy hour: $6 drafts", venue: "The Ainsworth", address: "122 W 26th St, New York, NY", start: null, category: "deal", price: null, deal: "$6 drafts and half-off wings, 4–7pm weekdays", description: "Easy pre-game spot before heading downtown.", lat: 40.7453, lng: -73.9926 },
  { ...base, id: "demo-3", title: "Warehouse techno night", venue: "Brooklyn Mirage", address: "140 Stewart Ave, Brooklyn, NY", start: at(1, 22), category: "nightlife", price: "$40", deal: null, description: "Open-air techno with a headline DJ set till 4am.", lat: 40.7118, lng: -73.9235 },
  { ...base, id: "demo-4", title: "Comedy showcase", venue: "Comedy Cellar", address: "117 MacDougal St, New York, NY", start: at(0, 21), category: "arts", price: "$20", deal: "2-drink minimum", description: "Stacked lineup of drop-in sets from working comics.", lat: 40.7302, lng: -74.0003 },
  { ...base, id: "demo-5", title: "Rooftop sunset session", venue: "Westlight", address: "111 N 12th St, Brooklyn, NY", start: at(2, 18), category: "nightlife", price: "Free", deal: null, description: "Skyline views with a DJ from golden hour on.", lat: 40.7219, lng: -73.9572 },
  { ...base, id: "demo-6", title: "Knicks watch party", venue: "Mustang Harry's", address: "352 7th Ave, New York, NY", start: at(1, 19), category: "sports", price: "Free", deal: "$5 Bud Lights during the game", description: "Packed bar, big screens, loud crowd.", lat: 40.7484, lng: -73.9935 },
  { ...base, id: "demo-7", title: "Night market", venue: "Queens Night Market", address: "47-01 111th St, Queens, NY", start: at(2, 17), category: "food_drink", price: "Free", deal: null, description: "Dozens of food stalls from around the world, every dish under $6.", lat: 40.7449, lng: -73.8492 },
  { ...base, id: "demo-8", title: "Indie double bill", venue: "Bowery Ballroom", address: "6 Delancey St, New York, NY", start: at(3, 20), category: "music", price: "$30", deal: null, description: "Two up-and-coming bands in one of the city's best-sounding rooms.", lat: 40.7204, lng: -73.9935 },
  { ...base, id: "demo-9", title: "Gallery opening + wine", venue: "Chelsea gallery walk", address: "W 24th St & 10th Ave, New York, NY", start: at(3, 18), category: "community", price: "Free", deal: "Free wine at openings", description: "Thursday openings across Chelsea — hop between galleries.", lat: 40.7488, lng: -74.0047 },
  { ...base, id: "demo-10", title: "Trivia night", venue: "Pete's Tavern", address: "129 E 18th St, New York, NY", start: at(0, 20), category: "community", price: "Free", deal: "$20 pitchers for teams", description: "Teams of up to six, bar tab for the winners.", lat: 40.7363, lng: -73.9871 },
];
