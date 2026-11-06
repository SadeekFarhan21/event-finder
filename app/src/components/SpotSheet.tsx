// Spot details, modeled on Yelo's spot card: venue, when/where/price, Ride and Unlock.
// A real bottom sheet: springs up, drags down to dismiss, backdrop fades with the drag.
import { useEffect, useState, type ComponentProps } from "react";
import { BackHandler, Dimensions, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, { FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { estimateFare, type Point } from "../lib/fare";
import { openRide } from "../lib/ride";
import { track } from "../data/activity";
import { inviteMessage } from "../data/social";
import { crewInvite, type Crew, type CrewStatus } from "../data/crews";
import { CrewCard } from "./CrewCard";
import { StartCrew } from "./StartCrew";
import { whenLabel } from "../lib/time";
import type { Spot } from "../lib/types";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

const SCREEN_H = Dimensions.get("window").height;
const OFFSCREEN = SCREEN_H;
const OPEN = { damping: 24, stiffness: 240, mass: 0.9 };

type Props = {
  spot: Spot | null; city: string; me: Point | null; unlocked: boolean;
  canAskLocation: boolean; onAskLocation: () => void; // ask for location here, where the ride price explains why
  onUnlock: (spot: Spot) => void; onClose: () => void;
  going: number; isGoing: boolean; onGo: (spot: Spot) => void; // "I'm going" + live count
  crew?: Crew; canCrew: boolean; // my crew for this spot, if any
  onStartCrew: (spot: Spot, leaveAt: Date, name: string) => Promise<string>;
  onCrewStatus: (code: string, s: CrewStatus) => void;
};

export function SpotSheet({ spot, city, me, unlocked, canAskLocation, onAskLocation, onUnlock, onClose, going, isGoing, onGo,
  crew, canCrew, onStartCrew, onCrewStatus }: Props) {
  const y = useSharedValue(OFFSCREEN);
  const [shown, setShown] = useState<Spot | null>(null); // stays mounted while sliding out
  const [composing, setComposing] = useState(false); // the "Heading out" crew composer is open

  useEffect(() => {
    if (!spot) return;
    setShown(spot);
    setComposing(false);
    track(spot, "view", city);
    y.value = OFFSCREEN;
    y.value = withSpring(0, OPEN);
  }, [spot?.id]);

  const close = () => {
    y.value = withTiming(OFFSCREEN, { duration: 240 }, (done) => { if (done) scheduleOnRN(finish); });
  };
  const finish = () => { setShown(null); onClose(); };

  // Android's back button closes the sheet instead of leaving the app.
  useEffect(() => {
    if (!shown) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => sub.remove();
  }, [shown]);

  const drag = Gesture.Pan()
    .onUpdate((e) => { y.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        y.value = withTiming(OFFSCREEN, { duration: 200 }, (done) => { if (done) scheduleOnRN(finish); });
      } else {
        y.value = withSpring(0, OPEN);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 400], [1, 0], "clamp") }));

  const insets = useSafeAreaInsets();
  if (!shown) return null;
  const e = shown;
  const fare = me ? estimateFare(me, { lat: e.lat, lng: e.lng }) : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      {/* Drag from the top (handle + photo) to dismiss; the details scroll on their own. */}
      <Animated.View style={[s.sheet, sheetStyle]}>
        <GestureDetector gesture={drag}>
          {e.image ? (
            <View>
              <Image source={e.image} style={s.hero} contentFit="cover" transition={250} />
              <View style={[s.grabber, s.grabberOnImage]} />
            </View>
          ) : <View style={s.handle}><View style={s.grabber} /></View>}
        </GestureDetector>

        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={s.eyebrow}>{e.partner ? "Yelo partner  ·  " : ""}{e.category === "deal" ? "Deal" : CATEGORY[e.category].label}</Text>
          <Text style={s.title} numberOfLines={2}>{e.venue}</Text>
          <Text style={s.event}>{e.title}</Text>
          {!!e.description && <Text style={s.desc}>{e.description}</Text>}

          <View style={s.rows}>
            <Row icon="time-outline" text={whenLabel(e)} />
            <Row icon="location-outline" text={e.address} />
            {e.price && <Row icon="ticket-outline" text={e.price} />}
            {!me && canAskLocation && (
              <Tap pressedScale={0.99} onPress={onAskLocation} accessibilityLabel="Use my location to see the ride price">
                <View style={s.row}>
                  <Ionicons name="car-outline" size={17} color={C.ink2} />
                  <Text style={s.rowText}>See ride price</Text>
                  <Text style={s.rowAction}>Use my location</Text>
                </View>
              </Tap>
            )}
            {fare && (
              <Row icon="car-outline"
                text={`${fare.miles < 0.95 ? fare.miles.toFixed(1) : Math.round(fare.miles)} mi · about $${fare.yelo} with Yelo (Uber/Lyft ~$${fare.typical})`} />
            )}
          </View>

          {/* Turn one person's plan into a group: say you're going, then pull friends in. */}
          <View style={s.social}>
            <Text style={s.socialCount}>
              {going ? `${going} going` : "Be the first to say you're going"}{isGoing ? "  ·  including you" : ""}
            </Text>
            <View style={s.socialBtns}>
              <Tap style={[s.chip, isGoing && s.chipOn]} disabled={isGoing} accessibilityState={{ selected: isGoing }}
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onGo(e); }}>
                <Ionicons name={isGoing ? "checkmark" : "hand-right-outline"} size={16} color={C.ink} />
                <Text style={s.chipText}>{isGoing ? "You're going" : "I'm going"}</Text>
              </Tap>
              {canCrew && !crew && (
                <Tap style={[s.chip, composing && s.chipOn]} onPress={() => { Haptics.selectionAsync(); setComposing((c) => !c); }}
                  accessibilityState={{ expanded: composing }}>
                  <Ionicons name="people-outline" size={16} color={C.ink} />
                  <Text style={s.chipText}>Heading out</Text>
                </Tap>
              )}
              <Tap style={[s.chip, s.chipIcon]} accessibilityLabel="Send this spot to friends" onPress={async () => {
                const r = await Share.share({ message: inviteMessage(e, isGoing) }).catch(() => null);
                if (r?.action === Share.sharedAction) track(e, "share", city);
              }}>
                <Ionicons name="paper-plane-outline" size={16} color={C.ink} />
              </Tap>
            </View>
            {composing && !crew && (
              <Animated.View entering={FadeInDown.springify().damping(18)}>
                <StartCrew spot={e} onCancel={() => setComposing(false)} onStart={async (leaveAt, name) => {
                  const code = await onStartCrew(e, leaveAt, name);
                  setComposing(false);
                  if (!isGoing) onGo(e);
                  track(e, "share", city);
                  Share.share({ message: crewInvite({ venue: e.venue, title: e.title, leaveAt: leaveAt.toISOString(), code }) }).catch(() => {});
                }} />
              </Animated.View>
            )}
            {crew && (
              <Animated.View entering={FadeInDown.springify().damping(18)}>
                <CrewCard crew={crew} onStatus={onCrewStatus} onRide={() => { track(e, "ride", city); openRide(e); }} />
              </Animated.View>
            )}
          </View>

          {e.deal && unlocked && (
            <Animated.View entering={FadeInDown.springify().damping(16)} style={s.dealCard}>
              <Text style={s.dealLabel}>Your deal</Text>
              <Text style={s.dealText}>{e.deal}</Text>
              <Text style={s.dealHint}>Show this at the door or bar.</Text>
            </Animated.View>
          )}

          <Text style={s.source}>
            {e.source === "demo" ? "Demo listing" : e.source === "venue" ? "Listed by the venue"
              : e.confidence === "low" ? "Unconfirmed listing. Check the event page before you go."
              : "Found on the web"}
            {fare ? "  ·  Fares are estimates" : ""}
          </Text>
        </ScrollView>

        {/* Actions stay put while the details scroll */}
        <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Tap style={[s.btn, s.btnPrimary]} onPress={() => { track(e, "ride", city); openRide(e); }}>
            <Ionicons name="car-outline" size={18} color={C.ink} />
            <Text style={s.btnPrimaryText}>{fare ? `Ride · ~$${fare.yelo}` : "Ride there"}</Text>
          </Tap>
          {e.deal ? (
            <Tap style={[s.btn, s.btnDeal, unlocked && { opacity: 0.45 }]} disabled={unlocked}
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); track(e, "unlock", city); onUnlock(e); }}>
              <Text style={s.btnDealText}>{unlocked ? "Unlocked" : "Unlock deal"}</Text>
            </Tap>
          ) : e.url && /^https?:\/\//i.test(e.url) ? (
            <Tap style={[s.btn, s.btnQuiet]} onPress={() => Linking.openURL(e.url!)}>
              <Text style={s.btnQuietText}>Event page</Text>
            </Tap>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function Row({ icon, text }: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={s.row}>
      <Ionicons name={icon} size={17} color={C.ink2} />
      <Text style={s.rowText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.scrim },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: SCREEN_H * 0.88, backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet,
    overflow: "hidden", ...shadow, shadowOffset: { width: 0, height: -2 } },
  hero: { height: 190, backgroundColor: C.fill },
  handle: { paddingBottom: 8 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.hairline, marginTop: 8 },
  grabberOnImage: { position: "absolute", top: 0, backgroundColor: "rgba(255,255,255,0.85)" },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  eyebrow: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3, letterSpacing: 0.3 },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 44, color: C.ink, marginTop: 2 },
  event: { fontFamily: F.semibold, fontSize: T.body, color: C.ink, marginTop: 12 },
  desc: { fontFamily: F.regular, fontSize: T.body, lineHeight: 22, color: C.ink2, marginTop: 4 },
  rows: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hairline },
  rowText: { flex: 1, fontFamily: F.regular, fontSize: T.body, color: C.ink },
  rowAction: { fontFamily: F.semibold, fontSize: T.small, color: C.ink, textDecorationLine: "underline" },
  social: { marginTop: 20, gap: 12 },
  socialCount: { fontFamily: F.medium, fontSize: T.small, color: C.ink3 },
  socialBtns: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, height: 44, borderRadius: R.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.hairline, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.fill, borderColor: C.ink2 },
  chipIcon: { flex: 0, width: 44 },
  chipText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  dealCard: { marginTop: 20, padding: 16, borderRadius: R.md, backgroundColor: C.blue },
  dealLabel: { fontFamily: F.medium, fontSize: T.meta, color: "rgba(255,255,255,0.7)" },
  dealText: { fontFamily: F.semibold, fontSize: T.body, lineHeight: 24, color: C.surface, marginTop: 4 },
  dealHint: { fontFamily: F.regular, fontSize: T.small, color: "rgba(255,255,255,0.7)", marginTop: 8 },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline, backgroundColor: C.surface },
  btn: { flex: 1, height: 52, borderRadius: R.pill, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: C.yellow },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: T.body, color: C.ink },
  btnDeal: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.blue },
  btnDealText: { fontFamily: F.semibold, fontSize: T.body, color: C.blue },
  btnQuiet: { backgroundColor: C.fill },
  btnQuietText: { fontFamily: F.semibold, fontSize: T.body, color: C.ink },
  source: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 16 },
});
