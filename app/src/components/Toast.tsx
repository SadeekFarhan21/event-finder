import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HEADER_GAP, HEADER_H } from "../layout";
import { useOffline } from "../hooks/useOffline";
import { OFFLINE_SPACE } from "./OfflineBanner";
import { color as C, font as F, radius as R, text as T } from "../theme";

export function Toast({ text, visible }: { text: string; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const offline = useOffline(); // the offline banner holds the spot under the header; sit below it
  // pointerEvents="none" keeps it out of the way of taps, so VoiceOver/TalkBack hear it this way.
  useEffect(() => { if (visible && text) AccessibilityInfo.announceForAccessibility(text); }, [visible, text]);
  if (!visible) return null;
  return (
    <Animated.View key={text} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(220)}
      pointerEvents="none" style={[s.toast, { top: insets.top + HEADER_GAP + HEADER_H + 8 + (offline ? OFFLINE_SPACE : 0) }]}>
      <Text style={s.text}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: { position: "absolute", alignSelf: "center", backgroundColor: C.d3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill },
  text: { fontFamily: F.medium, fontSize: T.small, color: C.ink },
});
