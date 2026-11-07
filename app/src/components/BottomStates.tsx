// What sits where the cards go when there are no cards: a loading shimmer, or an empty state.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { CARD_W, CAROUSEL_BOTTOM, MEDIA_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";

// Laid out like a real spot card (photo, venue, facts, footer with the Ride pill), so nothing
// jumps when the spots arrive.
export function LoadingCard() {
  const pulse = useSharedValue(0.45);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true); }, []);
  const shimmer = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={s.card}
      accessible accessibilityLabel="Loading spots" accessibilityState={{ busy: true }}>
      <Animated.View style={[s.media, shimmer]} />
      <View style={s.body}>
        <Animated.View style={[s.line, { width: "55%", height: 24 }, shimmer]} />
        <Animated.View style={[s.line, { width: "80%", marginTop: 8 }, shimmer]} />
        <View style={s.footer}>
          <Animated.View style={[s.dot, shimmer]} />
          <Animated.View style={[s.line, { width: 88 }, shimmer]} />
          <Animated.View style={[s.pill, shimmer]} />
        </View>
      </View>
    </Animated.View>
  );
}

export function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.card, s.empty]} accessibilityRole="summary">
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{body}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { position: "absolute", bottom: CAROUSEL_BOTTOM, alignSelf: "center", width: CARD_W, backgroundColor: C.surface, borderRadius: R.lg,
    overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow },
  media: { height: MEDIA_H, backgroundColor: C.d2 },
  body: { paddingHorizontal: 16, paddingVertical: 12 },
  line: { height: 12, borderRadius: R.sm, backgroundColor: C.d2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.d2 },
  pill: { marginLeft: "auto", width: 96, height: 36, borderRadius: R.pill, backgroundColor: C.d2 },
  empty: { padding: 20 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  message: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink2, marginTop: 4 },
});
