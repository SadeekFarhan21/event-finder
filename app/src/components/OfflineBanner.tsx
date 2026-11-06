// A slim notice under the search bar while requests are failing. It explains why nothing
// updates (instead of a silent stale map) and disappears on the next successful request.
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { isOffline, onNetworkChange } from "../lib/net";
import { HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";

export function OfflineBanner({ top }: { top: number }) {
  const [offline, setOffline] = useState(isOffline());
  useEffect(() => onNetworkChange(setOffline), []);
  if (!offline) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={[s.banner, { top: top + HEADER_GAP + HEADER_H + 8 }]}
      accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={C.ink2} />
      <Text style={s.text}>No connection. Showing what loaded last.</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.d3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow },
  text: { flex: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink },
});
