import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F, radius as R, text as T } from "../theme";

export function Toast({ text, visible }: { text: string; visible: boolean }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Animated.View key={text} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(220)}
      pointerEvents="none" style={[s.toast, { top: insets.top + HEADER_GAP + HEADER_H + 8 }]}>
      <Text style={s.text}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: { position: "absolute", alignSelf: "center", backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  text: { fontFamily: F.medium, fontSize: T.small, color: "#fff" },
});
