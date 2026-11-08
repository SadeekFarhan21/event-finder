// What sits where the cards go when there are no cards: a loading shimmer, or an empty state.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { CARD_W, CAROUSEL_BOTTOM, MEDIA_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

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

// action: the one way out of this state ("Search without "late""), as a quiet pill under the message.
export function EmptyCard({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[s.card, s.empty]}>
      <Text style={s.title} accessibilityRole="header">{title}</Text>
      <Text style={s.message}>{body}</Text>
      {action && (
        <Tap onPress={action.onPress} hitSlop={6} style={s.action} accessibilityLabel={action.label}>
          <Text style={s.actionText} numberOfLines={1}>{action.label}</Text>
        </Tap>
      )}
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
  action: { alignSelf: "flex-start", maxWidth: "100%", height: 36, paddingHorizontal: 16, marginTop: 16, borderRadius: R.pill, justifyContent: "center",
    backgroundColor: C.d2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  actionText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
