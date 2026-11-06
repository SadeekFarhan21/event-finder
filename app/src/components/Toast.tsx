import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { color as C, font as F, radius as R } from "../theme";

export function Toast({ text, visible }: { text: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <Animated.View key={text} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(220)}
      pointerEvents="none" style={s.toast}>
      <Text style={s.text}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: { position: "absolute", top: 162, alignSelf: "center", backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  text: { fontFamily: F.medium, fontSize: 13, color: "#fff" },
});
