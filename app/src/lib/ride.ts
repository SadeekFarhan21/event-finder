// Stand-in for a Yelo ride request: hand the destination to the phone's maps app.
import { Linking, Platform } from "react-native";
import type { Spot } from "./types";
import { config } from "../config";

export function openRide(e: Pick<Spot, "venue" | "address" | "lat" | "lng">) {
  const dest = `${e.venue}, ${e.address}`;
  const q = encodeURIComponent(dest);
  const url = Platform.OS === "android" ? `google.navigation:q=${e.lat},${e.lng}` : `maps://?daddr=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(config.directionsUrl(dest)));
}
