import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Point } from "../lib/fare";

// Where the rider is, for ride estimates. Never prompts on launch: if permission was already
// given we use it quietly; otherwise `ask()` is called from the spot sheet, where the reason
// (a ride price) is on screen.
export function useMyLocation() {
  const [me, setMe] = useState<Point | null>(null);
  const [canAsk, setCanAsk] = useState(false); // false once the OS won't show the prompt again

  const locate = useCallback(async () => {
    const last = await Location.getLastKnownPositionAsync();
    if (last) setMe({ lat: last.coords.latitude, lng: last.coords.longitude });
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setMe({ lat: now.coords.latitude, lng: now.coords.longitude });
  }, []);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => (p.granted ? locate() : setCanAsk(p.canAskAgain)))
      .catch(() => {});
  }, [locate]);

  const ask = useCallback(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setCanAsk(!p.granted && p.canAskAgain);
    if (p.granted) await locate().catch(() => {});
  }, [locate]);

  return { me, canAsk, ask };
}
