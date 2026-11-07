import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Spot } from "../lib/types";
import { crewsAvailable, joinCrew, loadCrews, setStatus, startCrew, type Crew, type CrewStatus } from "../data/crews";

// My crews, kept fresh: friends join and change status while you're looking, so refetch every
// 20s while the app is in front (and right away when it comes back).
// onNews: one line when a friend joins, heads out, or drops out ("Maya is on the way to Nublu").
// Only other people's changes, and never on the first load (that would announce old news).
export function useCrews(onNews?: (message: string) => void) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const seen = useRef<Map<string, Map<string, string>> | null>(null); // crew code -> member name -> status
  const news = useRef(onNews);
  useEffect(() => { news.current = onNews; }); // latest callback, without re-creating refresh

  const refresh = useCallback(() => {
    if (!crewsAvailable()) return;
    loadCrews().then((next) => {
      const before = seen.current;
      if (before) {
        const lines: string[] = [];
        for (const c of next) {
          const was = before.get(c.code);
          if (!was) continue; // a crew I just started or joined
          for (const m of c.members) {
            if (m.me) continue;
            const prev = was.get(m.name);
            if (prev === undefined) lines.push(`${m.name} joined your crew to ${c.venue}`);
            else if (prev !== m.status && m.status === "on_way") lines.push(`${m.name} is on the way to ${c.venue}`);
            else if (prev !== m.status && m.status === "out") lines.push(`${m.name} can't make it to ${c.venue}`);
          }
        }
        if (lines.length) news.current?.(lines.length === 1 ? lines[0] : `${lines[0]} · ${lines.length - 1} more update${lines.length > 2 ? "s" : ""}`);
      }
      seen.current = new Map(next.map((c) => [c.code, new Map(c.members.map((m) => [m.name, m.status]))]));
      setCrews(next);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    let timer = setInterval(refresh, 20_000);
    const sub = AppState.addEventListener("change", (s) => {
      clearInterval(timer);
      if (s === "active") { refresh(); timer = setInterval(refresh, 20_000); }
    });
    return () => { clearInterval(timer); sub.remove(); };
  }, [refresh]);

  const start = useCallback(async (spot: Spot, leaveAt: Date, name: string) => {
    const code = await startCrew(spot, leaveAt, name);
    refresh();
    return code;
  }, [refresh]);

  const join = useCallback(async (code: string, name: string) => {
    const clean = await joinCrew(code, name);
    refresh();
    return clean;
  }, [refresh]);

  const status = useCallback(async (code: string, s: CrewStatus): Promise<boolean> => {
    // Show it right away. If it can't be saved (offline), put the old status back and say so,
    // rather than showing friends a status they'll never see.
    let before: Crew[] = [];
    setCrews((all) => { before = all; return all.map((c) => c.code !== code ? c
      : { ...c, members: c.members.map((m) => (m.me ? { ...m, status: s } : m)) }); });
    try { await setStatus(code, s); return true; }
    catch { setCrews(before); return false; } // the screen that asked says so, next to the buttons
  }, []);

  return { crews, refresh, start, join, status, available: crewsAvailable() };
}
