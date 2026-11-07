import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { track } from "../data/activity";
import { unsave } from "../data/social";
import type { Spot } from "../lib/types";

// Spots this rider saved for later: a private shortlist kept on the phone (no account, nothing shared).
const KEY = "scout.saved";

export function useSaved() {
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => { if (raw) setSaved(new Set(JSON.parse(raw) as string[])); }).catch(() => {});
  }, []);

  // Saving also tells the venue (an anonymous count on its dashboard); unsaving takes it back.
  // Side effects stay outside the state update (React may run an updater twice in development).
  const toggle = useCallback((spot: Spot, city: string) => {
    const was = saved.has(spot.id);
    if (was) unsave(spot.id).catch(() => {}); else track(spot, "save", city);
    const next = new Set(saved);
    if (was) next.delete(spot.id); else next.add(spot.id);
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify([...next].slice(-300))).catch(() => {});
  }, [saved]);

  return { saved, toggle };
}
