import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { crewsAvailable, joinCrew, loadCrews, setStatus, startCrew, type Crew, type CrewStatus } from "../data/crews";

// My crews, kept fresh: friends join and change status while you're looking, so refetch every
// 20s while the app is in front (and right away when it comes back).
export function useCrews() {
  const [crews, setCrews] = useState<Crew[]>([]);

  const refresh = useCallback(() => {
    if (crewsAvailable()) loadCrews().then(setCrews).catch(() => {});
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

  const start = useCallback(async (spotId: string, leaveAt: Date, name: string) => {
    const code = await startCrew(spotId, leaveAt, name);
    refresh();
    return code;
  }, [refresh]);

  const join = useCallback(async (code: string, name: string) => {
    const clean = await joinCrew(code, name);
    refresh();
    return clean;
  }, [refresh]);

  const status = useCallback(async (code: string, s: CrewStatus) => {
    // Show it right away; the next refresh confirms.
    setCrews((all) => all.map((c) => c.code !== code ? c
      : { ...c, members: c.members.map((m) => (m.me ? { ...m, status: s } : m)) }));
    await setStatus(code, s).catch(refresh);
  }, [refresh]);

  return { crews, refresh, start, join, status, available: crewsAvailable() };
}
