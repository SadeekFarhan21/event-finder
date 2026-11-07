// A slim notice under the search bar while requests are failing. It explains why nothing
// updates (instead of a silent stale map) and disappears on the next successful request.
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useOffline } from "../hooks/useOffline";
import { HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";

// How far the banner reaches below its top edge (one line, 12 + 20 + 12), plus the 8 gap: toasts
// shown while offline start below it instead of covering it.
export const OFFLINE_SPACE = 44 + 8;

export function OfflineBanner({ top }: { top: number }) {
  if (!useOffline()) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={[s.banner, { top: top + HEADER_GAP + HEADER_H + 8 }]}
      accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={16} color={C.ink2} />
      <Text style={s.text} numberOfLines={1}>No connection. Showing what loaded last.</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md, backgroundColor: C.d3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow },
  text: { flex: 1, fontFamily: F.medium, fontSize: T.small, lineHeight: 20, color: C.ink },
});
