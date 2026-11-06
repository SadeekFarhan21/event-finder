import { useEffect, useState } from "react";
import { getLeads } from "../data/api";
import type { Lead } from "../lib/types";

// Room leads for the city on the map; refetched when the city changes.
export function useLeads(city: string | null) {
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    if (!city) return;
    getLeads(city).then(setLeads).catch(() => setLeads([]));
  }, [city]);
  return [leads, setLeads] as const;
}
