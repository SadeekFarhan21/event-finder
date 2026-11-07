import { useCallback, useEffect, useState } from "react";
import { track } from "../data/activity";
import { goingCounts, loadMine, saveMine, ungo } from "../data/social";
import type { Spot } from "../lib/types";

// Who's going where: live counts for the spots on the map plus what this device said.
// Tapping "I'm going" bumps the count right away; the server dedupes by device.
export function useGoing(spots: Spot[], city: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => { loadMine().then(setMine); }, []);

  const ids = spots.map((e) => e.id).join("|");
  useEffect(() => {
    if (!spots.length) return;
    goingCounts(spots.map((e) => e.id)).then(setCounts).catch(() => {});
  }, [ids]);

  const go = useCallback((e: Spot) => {
    if (mine.has(e.id)) return;
    const next = new Set(mine).add(e.id);
    setMine(next);
    saveMine(next);
    setCounts((c) => ({ ...c, [e.id]: (c[e.id] ?? 0) + 1 }));
    track(e, "going", city ?? "");
  }, [mine, city]);

  // Undo: drop it locally right away, then on the server; restore if the server says no.
  const unGo = useCallback((e: Spot) => {
    if (!mine.has(e.id)) return;
    const next = new Set(mine);
    next.delete(e.id);
    setMine(next);
    saveMine(next);
    setCounts((c) => ({ ...c, [e.id]: Math.max(0, (c[e.id] ?? 1) - 1) }));
    ungo(e.id).catch(() => {
      const back = new Set(next).add(e.id);
      setMine(back);
      saveMine(back);
      setCounts((c) => ({ ...c, [e.id]: (c[e.id] ?? 0) + 1 }));
    });
  }, [mine]);

  return { counts, mine, go, unGo };
}
