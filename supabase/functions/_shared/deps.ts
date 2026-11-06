// What the agents need from their host. The Node dev server and the Supabase Edge Function
// each supply their own: an Exa client and a geocode cache (JSON file vs. Postgres table).
// Keeping these injected means this folder has no runtime-specific imports.

export type Grounding = { field: string; confidence: "low" | "medium" | "high"; citations: { url: string }[] };

// The slice of exa-js we use: search() with an outputSchema.
export type ExaLike = {
  search(query: string, options: Record<string, unknown>): Promise<{ output?: { content: unknown; grounding?: Grounding[] } }>;
};

export type Point = { lat: number; lng: number };

export type GeoCache = {
  get(key: string): Promise<Point | null | undefined>; // undefined = never looked up
  set(key: string, value: Point | null): Promise<void>;
};

export type AgentDeps = {
  exa: ExaLike;
  geo: GeoCache;
  log?: (msg: string) => void;
  deadline?: number; // epoch ms; stop geocoding past this (Edge Functions have a wall-clock limit)
};

export const isRateLimit = (err: unknown) => (err as { statusCode?: number })?.statusCode === 429;
