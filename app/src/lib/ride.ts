// Stand-in for a Yelo ride request: hand the destination to the phone's maps app.
import { Linking, Platform } from "react-native";
import type { Spot } from "./types";

export function openRide(e: Pick<Spot, "venue" | "address" | "lat" | "lng">) {
  const q = encodeURIComponent(`${e.venue}, ${e.address}`);
  const url = Platform.OS === "android" ? `google.navigation:q=${e.lat},${e.lng}` : `maps://?daddr=${q}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
}
