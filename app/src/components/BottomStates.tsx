// What sits where the cards go when there are no cards: a loading shimmer, or an empty state.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { CARD_W, CAROUSEL_BOTTOM } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";

export function LoadingCard() {
  const pulse = useSharedValue(0.45);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, []);
  const shimmer = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.card, s.loading]}>
      <Animated.View style={[s.thumb, shimmer]} />
      <View style={{ flex: 1, gap: 8 }}>
        <Animated.View style={[s.line, { width: "45%" }, shimmer]} />
        <Animated.View style={[s.line, { width: "80%", height: 24 }, shimmer]} />
        <Animated.View style={[s.line, { width: "60%" }, shimmer]} />
      </View>
    </Animated.View>
  );
}

export function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.card, s.empty]}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { position: "absolute", bottom: CAROUSEL_BOTTOM, alignSelf: "center", width: CARD_W, backgroundColor: C.surface, borderRadius: R.lg, ...shadow },
  loading: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  thumb: { width: 64, height: 64, borderRadius: R.md, backgroundColor: C.fill },
  line: { height: 12, borderRadius: 6, backgroundColor: C.fill },
  empty: { padding: 20 },
  title: { fontFamily: F.display, fontSize: T.title, color: C.ink },
  body: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink2, marginTop: 4 },
});
