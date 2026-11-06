// Shapes shared by the app. They mirror the Supabase rows (see supabase/migrations).

export type Category = "nightlife" | "music" | "food_drink" | "arts" | "sports" | "community" | "deal";
export type Confidence = "low" | "medium" | "high";

// A spot on the map: an event, or a standing deal like a happy hour.
export type Spot = {
  id: string;
  title: string;
  venue: string;
  address: string;
  start: string | null;
  category: Category;
  price: string | null;
  deal: string | null;
  description: string;
  url: string | null;
  image?: string | null; // preview image of the source page, when the agent found one
  lat: number;
  lng: number;
  confidence: Confidence;
  source: "exa" | "demo" | "venue";
  partner?: boolean; // one of Yelo's venue partners
  discovered_at?: string; // when the agent first found it (never moves forward)
};

// "Rooms": a venue that could host a Yelo night.
export type Lead = {
  id: string;
  venue: string;
  area: string;
  address: string;
  kind: string;
  capacity: string | null;
  fit: string;
  quietNight: string | null;
  contact: string | null;
  url: string | null;
  confidence: Confidence;
};
