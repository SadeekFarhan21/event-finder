import { useCallback, useState } from "react";
import { canScout, getSpots, runScout } from "../data/api";
import type { Spot } from "../lib/types";

// The spots for the city on the map, plus loading and scouting state.
export function useSpots() {
  const [city, setCity] = useState<string | null>(null); // the city currently on the map
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [scouting, setScouting] = useState(false);
  const [scoutable, setScoutable] = useState(false);

  const load = useCallback(async (next: string) => {
    setLoading(true);
    try {
      const [ok, list] = await Promise.all([canScout().catch(() => false), getSpots(next)]);
      setScoutable(ok);
      setCity(next);
      setSpots(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  // Runs the discovery agent for the city; resolves once fresh results are in.
  const scout = useCallback(async (target: string) => {
    setScouting(true);
    try {
      const { spots: list, added } = await runScout(target);
      setCity(target);
      setSpots(list);
      return { list, added };
    } finally {
      setScouting(false);
    }
  }, []);

  return { city, spots, loading, scouting, scoutable, load, scout };
}
