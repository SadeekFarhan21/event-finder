import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Spots this rider saved for later: a private shortlist kept on the phone (no account, nothing shared).
const KEY = "scout.saved";

export function useSaved() {
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => { if (raw) setSaved(new Set(JSON.parse(raw) as string[])); }).catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setSaved((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(KEY, JSON.stringify([...next].slice(-300))).catch(() => {});
      return next;
    });
  }, []);

  return { saved, toggle };
}
