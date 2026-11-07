// The swipeable cards along the bottom. The centered card sits at full size; its neighbors
// ease back as you swipe. Settling on a card focuses it on the map.
import { useImperativeHandle, type Ref } from "react";
import { StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Extrapolation, FadeInDown, interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { clock, isRecurring, whenLabel, dealStatus } from "../lib/time";
import type { Stop } from "../lib/plan";
import { calmCaps, similar } from "../lib/case";
import { goingLine, type CrewPeople } from "../lib/friends";
import { estimateFare, type Point } from "../lib/fare";
import type { Spot } from "../lib/types";
import { CARD_GAP, CARD_INSET, CARD_STEP, CARD_W, CAROUSEL_BOTTOM, MEDIA_H } from "../layout";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

type Step = Pick<Stop, "step" | "hop">;
export type CarouselRef = { scrollTo: (index: number, animated?: boolean) => void };

type Props = {
  ref?: Ref<CarouselRef>;
  spots: Spot[];
  going: Record<string, number>; // spot id -> people going
  crewPeople?: Record<string, CrewPeople>; // spot id -> your crew heading there
  me?: Point | null; // the rider's location, if shared
  fresh?: Set<string>; // ids found since the last visit
  steps?: Record<string, Step>; // Plan my night: spot id -> its place in the plan
  activeId: string | null;
  onSettle: (spot: Spot) => void; // a swipe came to rest on this card
  onPress: (spot: Spot, index: number) => void;
  onRide: (spot: Spot) => void;
  onSwap?: (spot: Spot) => void; // Plan my night: replace this stop with the next best one
};

export function SpotCarousel({ ref, spots, fresh, steps, onSwap, going, crewPeople, me, activeId, onSettle, onPress, onRide }: Props) {
  const list = useAnimatedRef<Animated.FlatList<Spot>>();
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });

  useImperativeHandle(ref, () => ({
    scrollTo: (index, animated = true) => list.current?.scrollToOffset({ offset: index * CARD_STEP, animated }),
  }), [list]);

  const onEnd = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(Math.round(ev.nativeEvent.contentOffset.x / CARD_STEP), spots.length - 1));
    const spot = spots[i];
    if (spot && spot.id !== activeId) onSettle(spot);
  };

  return (
    <Animated.View key={spots.length ? spots[0].id : "empty"} entering={FadeInDown.springify().damping(20)} style={s.wrap}>
      <Animated.FlatList ref={list} data={spots} keyExtractor={(e) => e.id} horizontal showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STEP} decelerationRate="fast" disableIntervalMomentum
        contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: CARD_INSET }}
        onScroll={onScroll} scrollEventThrottle={16} onMomentumScrollEnd={onEnd}
        renderItem={({ item, index }) => <Card spot={item} step={steps?.[item.id]} isNew={!!fresh?.has(item.id)} going={going[item.id] ?? 0} crew={crewPeople?.[item.id]} me={me} index={index} x={x} onPress={() => onPress(item, index)} onRide={() => onRide(item)} onSwap={onSwap && (() => onSwap(item))} />} />
    </Animated.View>
  );
}

// "10 PM" / "Tonight"; standing deals read "Happy hour" / "Every night".
const bigTime = (e: Spot) => (isRecurring(e) || !e.start ? (/happy hour/i.test(`${e.title} ${e.deal ?? ""}`) ? "Happy hour" : "Any night") : clock(new Date(e.start)));
const bigDay = (e: Spot) => (isRecurring(e) || !e.start ? (dealStatus(e) ?? "Standing deal") : whenLabel(e).split(" · ")[0]);

// In a plan, the photo pill says the step instead of the day: "Then · 8 PM · 0.4 mi".
const stepLine = (e: Spot, st: Step) => [st.step, bigTime(e) === "Happy hour" || bigTime(e) === "Any night" ? dealStatus(e) : bigTime(e), st.hop].filter(Boolean).join(" · ");

// One line under the venue, with nothing said twice: category (unless the Deal tag says it),
// then the title (unless it's just "Happy hour" again), then the price.
function cardLine(e: Spot) {
  const title = calmCaps(e.title);
  const sameAsWhen = title.toLowerCase() === whenLabel(e).toLowerCase();
  const price = e.price && !similar(e.price, title) ? e.price : null;
  return [e.category === "deal" ? null : CATEGORY[e.category].label, sameAsWhen ? null : title, price]
    .filter(Boolean).join("  ·  ") || (e.deal ?? "");
}

// Photo first: the place, then when, then who's going and the ride. Most listings have no photo
// (the web rarely has a good one), so the fallback is a designed panel, not an empty box.
function Card({ spot: e, step, onSwap, isNew, going, crew, me, index, x, onPress, onRide }: {
  spot: Spot; step?: Step; isNew: boolean; going: number; crew?: CrewPeople; me?: Point | null; index: number; x: SharedValue<number>; onPress: () => void; onRide: () => void; onSwap?: () => void;
}) {
  // Distance once the rider has shared location (same figure as the sheet's "mi away").
  const miles = me ? (estimateFare(me, { lat: e.lat, lng: e.lng })?.miles ?? null) : null;
  const style = useAnimatedStyle(() => {
    const d = (x.value - index * CARD_STEP) / CARD_STEP; // 0 = centered, ±1 = one card away
    return {
      opacity: interpolate(Math.abs(d), [0, 1], [1, 0.6], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(Math.abs(d), [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={style}>
      <Tap onPress={onPress} pressedScale={0.985} style={s.card}>
        {e.image ? (
          <View style={s.media}>
            <Image source={e.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.55)"]} style={s.shade} />
            <View style={s.chips}>
              <View style={s.whenRow}>
                <View style={s.when}><Text style={s.whenText} numberOfLines={1}>{step ? stepLine(e, step) : whenLabel(e)}</Text></View>
                {isNew && <View style={s.newTag}><Text style={s.newText}>New</Text></View>}
              </View>
              {e.partner && <View style={s.partner}><View style={s.partnerMark} /><Text style={s.partnerText}>Yelo partner</Text></View>}
            </View>
          </View>
        ) : (
          // No photo: the time is the picture. Set large in the display face on a warm tonal band.
          <LinearGradient colors={[C.d3, C.d1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.media, s.typeBand]}>
            <View style={{ flex: 1 }}>
              <Text style={s.bigTime} numberOfLines={1} adjustsFontSizeToFit>{bigTime(e)}</Text>
              <Text style={s.bigDay} numberOfLines={1}>{step ? [step.step, isRecurring(e) ? dealStatus(e)?.replace(/^On /, "") : null, step.hop].filter(Boolean).join("  ·  ") : `${bigDay(e)}${isNew ? "  ·  New" : ""}`}</Text>
            </View>
            <View style={s.bandSide}>
              {e.partner && <View style={s.partner}><View style={s.partnerMark} /><Text style={s.partnerText}>Yelo partner</Text></View>}
            </View>
          </LinearGradient>
        )}
        <View style={s.body}>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{e.venue}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {cardLine(e)}
          </Text>
          <View style={s.footer}>
            <View style={s.going}>
              {miles !== null && <Text style={s.dist}>{miles < 0.95 ? miles.toFixed(1) : Math.round(miles)} mi</Text>}
              {miles !== null && <View style={s.distDot} />}
              {goingLine(going, crew) ? (
                <Text style={[s.goingText, crew?.others.length ? s.goingFriends : null]} numberOfLines={1}>{goingLine(going, crew)}</Text>
              ) : e.deal ? (
                <View style={s.deal}><Text style={s.dealText} numberOfLines={1}>Deal</Text></View>
              ) : (
                <Text style={s.goingText}>Be the first to go</Text>
              )}
            </View>
            {onSwap && (
              <Tap onPress={onSwap} style={s.swap} accessibilityLabel={`Swap ${e.venue} for another stop`} hitSlop={6}>
                <Feather name="shuffle" size={15} color={C.ink} /> {/* not refresh-cw: that one means "Look for new spots" */}
              </Tap>
            )}
            <Tap onPress={onRide} style={s.ride} accessibilityLabel={`Ride to ${e.venue}`} hitSlop={6}>
              <Text style={s.rideText}>Ride</Text>
            </Tap>
          </View>
        </View>
      </Tap>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: CAROUSEL_BOTTOM },
  card: { width: CARD_W, backgroundColor: C.surface, borderRadius: R.lg, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow },
  media: { height: MEDIA_H, backgroundColor: C.fill },
  whenRow: { flexDirection: "row", gap: 6, flexShrink: 1 },
  newTag: { paddingHorizontal: 10, height: 28, borderRadius: R.pill, justifyContent: "center", backgroundColor: C.ink },
  newText: { fontFamily: F.semibold, fontSize: T.meta, color: C.bg },
  typeBand: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  bigTime: { fontFamily: F.display, fontSize: 52, lineHeight: 58, color: C.ink },
  bigDay: { fontFamily: F.medium, fontSize: T.small, color: C.ink2, marginTop: -2 },
  bandSide: { alignItems: "flex-end" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 56 },
  chips: { position: "absolute", left: 12, right: 12, top: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  when: { paddingHorizontal: 12, height: 28, borderRadius: R.pill, justifyContent: "center", backgroundColor: "rgba(12,12,10,0.78)", flexShrink: 1 },
  whenText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  partnerMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  partner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 28, borderRadius: R.pill, justifyContent: "center", backgroundColor: "rgba(21,21,19,0.82)", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  partnerText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  sub: { fontFamily: F.regular, fontSize: T.small, color: C.ink2, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 },
  goingFriends: { color: C.ink },
  dist: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  distDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.ink3 },
  going: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  faces: { flexDirection: "row" },
  face: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.d3, borderWidth: 2, borderColor: C.surface, alignItems: "center", justifyContent: "center" },
  goingText: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  deal: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 24, borderRadius: R.pill, borderWidth: 1, borderColor: C.strong },
  dealText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink2 },
  swap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, marginLeft: "auto" },
  ride: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: C.accent },
  rideText: { fontFamily: F.semibold, fontSize: T.small, color: C.onAccent },
});
