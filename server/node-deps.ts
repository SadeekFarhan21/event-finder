// The local dev server's implementation of the agents' dependencies:
// exa-js from npm, and a JSON file for the geocode cache.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Exa from "exa-js";
import type { AgentDeps, ExaLike, GeoCache, Point } from "../supabase/functions/_shared/deps.ts";

const FILE = new URL("./data/geocache.json", import.meta.url);
const cache: Record<string, Point | null> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};

const fileGeoCache: GeoCache = {
  get: async (key) => (key in cache ? cache[key] : undefined),
  set: async (key, value) => {
    cache[key] = value;
    writeFileSync(FILE, JSON.stringify(cache, null, 1));
  },
};

export const nodeDeps = (log: (m: string) => void): AgentDeps => ({
  exa: new Exa(process.env.EXA_API_KEY) as unknown as ExaLike,
  geo: fileGeoCache,
  log,
});
