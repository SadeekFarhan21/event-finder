import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Point } from "../lib/fare";

// Where the rider is. Asks once; if they say no, fares just don't show.
export function useMyLocation() {
  const [me, setMe] = useState<Point | null>(null);
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) setMe({ lat: last.coords.latitude, lng: last.coords.longitude });
      const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe({ lat: now.coords.latitude, lng: now.coords.longitude });
    })().catch(() => {});
  }, []);
  return me;
}
