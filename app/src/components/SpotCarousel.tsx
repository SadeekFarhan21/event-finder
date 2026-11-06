// The swipeable cards along the bottom. The centered card sits at full size; its neighbors
// ease back as you swipe. Settling on a card focuses it on the map.
import { useImperativeHandle, type Ref } from "react";
import { StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Extrapolation, FadeInDown, interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { whenLabel } from "../lib/time";
import type { Spot } from "../lib/types";
import { CARD_GAP, CARD_INSET, CARD_STEP, CARD_W, CAROUSEL_BOTTOM } from "../layout";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

export type CarouselRef = { scrollTo: (index: number, animated?: boolean) => void };

type Props = {
  ref?: Ref<CarouselRef>;
  spots: Spot[];
  going: Record<string, number>; // spot id -> people going
  activeId: string | null;
  onSettle: (spot: Spot) => void; // a swipe came to rest on this card
  onPress: (spot: Spot, index: number) => void;
};

export function SpotCarousel({ ref, spots, going, activeId, onSettle, onPress }: Props) {
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
        renderItem={({ item, index }) => <Card spot={item} going={going[item.id] ?? 0} index={index} x={x} onPress={() => onPress(item, index)} />} />
    </Animated.View>
  );
}

function Card({ spot: e, going, index, x, onPress }: { spot: Spot; going: number; index: number; x: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = (x.value - index * CARD_STEP) / CARD_STEP; // 0 = centered, ±1 = one card away
    return {
      opacity: interpolate(Math.abs(d), [0, 1], [1, 0.75], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(Math.abs(d), [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={style}>
      <Tap onPress={onPress} style={s.card}>
        {e.image ? <Image source={e.image} style={s.thumb} contentFit="cover" transition={250} /> : null}
        <View style={s.body}>
          <View style={s.top}>
            <Text style={s.meta} numberOfLines={1}>{CATEGORY[e.category].label}  ·  {whenLabel(e)}</Text>
            {e.partner ? <View style={s.partner}><Text style={s.partnerText}>Yelo partner</Text></View>
              : e.deal ? <View style={s.deal}><Text style={s.dealText}>Deal</Text></View> : null}
          </View>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{e.venue}</Text>
          <Text style={s.sub} numberOfLines={1}>{going ? `${going} going  ·  ` : ""}{e.deal ?? e.title}</Text>
        </View>
      </Tap>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: CAROUSEL_BOTTOM },
  card: { width: CARD_W, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: R.lg,
    paddingHorizontal: 16, paddingVertical: 14, ...shadow },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: C.fill },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { flex: 1, fontFamily: F.medium, fontSize: T.meta, color: C.ink3 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink, marginTop: 4 },
  sub: { fontFamily: F.regular, fontSize: T.small, color: C.ink2, marginTop: 2 },
  partner: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.ink },
  partnerText: { fontFamily: F.semibold, fontSize: T.meta, color: C.yellow },
  deal: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.yellow },
  dealText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
});
