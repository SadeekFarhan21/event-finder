// One quiet hint on first launch: what the map is and the two things to try. Shown once per
// install, dismissed with "Got it" (or by opening any spot).
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

const KEY = "scout.hint.v1";

export function FirstRunHint({ top, city, dismissed }: { top: number; city: string; dismissed: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setShow(!v)).catch(() => {}); }, []);
  const done = () => { setShow(false); AsyncStorage.setItem(KEY, "1").catch(() => {}); };
  useEffect(() => { if (dismissed && show) done(); }, [dismissed]);
  if (!show) return null;
  return (
    <Animated.View entering={FadeInUp.delay(600)} exiting={FadeOutUp} style={[s.card, { top: top + HEADER_GAP + HEADER_H + 8 }]}
      accessibilityRole="summary">
      <View style={{ flex: 1 }}>
        <Text style={s.title}>What's on tonight in {city.split(",")[0]}</Text>
        <Text style={s.body}>Swipe the cards or tap a pin to see who's going, then ride there. A number means a few spots close together.</Text>
      </View>
      <Tap onPress={done} hitSlop={8} style={s.ok} accessibilityLabel="Dismiss hint"><Text style={s.okText}>Got it</Text></Tap>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 16, paddingLeft: 16, paddingRight: 12, paddingVertical: 12,
    borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow, zIndex: 15, elevation: 15 },
  title: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  body: { fontFamily: F.regular, fontSize: T.meta, lineHeight: 17, color: C.ink2, marginTop: 4 },
  ok: { height: 36, paddingHorizontal: 16, borderRadius: R.pill, justifyContent: "center", backgroundColor: C.d3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  okText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
