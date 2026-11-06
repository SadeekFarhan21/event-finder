// Spot details: the photo fades into the page, then the night in grouped cards (the bill, the
// logistics, who's going, the deal) and a docked action bar with one dominant button: Ride.
// A real bottom sheet: springs up, drags down to dismiss, backdrop fades with the drag.
// Everything shown is real data; nothing is decorative filler (no invented ratings or capacity).
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { BackHandler, Dimensions, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, { FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { estimateFare, type Point } from "../lib/fare";
import { openRide } from "../lib/ride";
import { config } from "../config";
import { track } from "../data/activity";
import { inviteMessage } from "../data/social";
import { crewInvite, type Crew, type CrewStatus } from "../data/crews";
import { CrewCard } from "./CrewCard";
import { StartCrew } from "./StartCrew";
import { isRecurring, whenLabel } from "../lib/time";
import type { Spot } from "../lib/types";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

const SCREEN_H = Dimensions.get("window").height;
const OFFSCREEN = SCREEN_H;
const OPEN = { damping: 24, stiffness: 240, mass: 0.9 };
const HERO_H = 260;
const HERO_H_NO_PHOTO = 132;
const ACCENT_TINT = "rgba(255,225,74,0.10)";
const ACCENT_EDGE = "rgba(255,225,74,0.32)";

type Icon = ComponentProps<typeof Ionicons>["name"];

type Props = {
  spot: Spot | null; city: string; me: Point | null; unlocked: boolean;
  canAskLocation: boolean; onAskLocation: () => void; // ask for location here, where the ride price explains why
  onUnlock: (spot: Spot) => void; onClose: () => void;
  going: number; isGoing: boolean; onGo: (spot: Spot) => void; // "I'm going" + live count
  crew?: Crew; canCrew: boolean; // my crew for this spot, if any
  onStartCrew: (spot: Spot, leaveAt: Date, name: string) => Promise<string>;
  onCrewStatus: (code: string, s: CrewStatus) => void;
};

// "151 Avenue C, East Village, New York, NY 10009" -> street "151 Avenue C", rest, area "East Village".
function splitAddress(address: string) {
  const [street, ...rest] = address.split(",").map((p) => p.trim());
  const area = rest.find((p) => !/^(new york|los angeles|brooklyn|ny|ca|usa)\b|\d{5}/i.test(p));
  return { street, rest: rest.join(", "), area };
}

// Happening right now: started, and within a typical night's length.
const isLive = (e: Spot) => !!e.start && !isRecurring(e) && Date.now() >= Date.parse(e.start) && Date.now() < Date.parse(e.start) + 5 * 3600e3;

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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

  // Pulling the photo down dismisses; pushing up is left to the scroll view.
  const drag = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-8)
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
  const addr = splitAddress(e.address);
  const live = isLive(e);
  const people = crew?.members.filter((m) => m.status !== "out") ?? [];
  const ride = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); track(e, "ride", city); openRide(e); };
  const share = async () => {
    const r = await Share.share({ message: inviteMessage(e, isGoing) }).catch(() => null);
    if (r?.action === Share.sharedAction) track(e, "share", city);
  };
  const unlock = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); track(e, "unlock", city); onUnlock(e); };
  const eventPage = e.url && /^https?:\/\//i.test(e.url) ? e.url : null;
  const source = e.source === "demo" ? "Demo listing" : e.source === "venue" ? "Listed by the venue"
    : e.confidence === "low" ? "Unconfirmed listing" : "Found on the web";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View style={[s.sheet, sheetStyle]}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false} bounces={false}>
          {/* Hero: drag it to dismiss. The photo fades into the page so the title sits on it. */}
          <GestureDetector gesture={drag}>
            <View style={{ height: e.image ? HERO_H : HERO_H_NO_PHOTO }}>
              {e.image ? (
                <Image source={e.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              ) : (
                <View style={s.noPhoto}><Ionicons name={CATEGORY[e.category].icon} size={72} color={C.d3} /></View>
              )}
              <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0.55)", "rgba(12,12,10,0)", "rgba(12,12,10,0)", C.bg]}
                locations={[0, 0.35, 0.55, 1]} style={StyleSheet.absoluteFill} />
              <View style={s.grabber} />
              <View style={s.heroTop}>
                <Tap style={s.glass} onPress={close} accessibilityLabel="Close"><Ionicons name="chevron-down" size={18} color={C.ink} /></Tap>
                <Tap style={s.glass} onPress={share} accessibilityLabel="Send this spot to friends"><Ionicons name="paper-plane-outline" size={16} color={C.ink} /></Tap>
              </View>
              <View style={s.heroChips}>
                {live ? (
                  <View style={s.glassChip}><View style={s.liveDot} /><Text style={s.glassChipText}>Live now</Text></View>
                ) : (
                  <View style={s.glassChip}><Text style={s.glassChipText}>{whenLabel(e)}</Text></View>
                )}
                {e.price && <View style={s.glassChip}><Text style={s.glassChipText}>{e.price}</Text></View>}
              </View>
            </View>
          </GestureDetector>

          <View style={s.content}>
            {/* Eyebrow + partner badge, then the venue as the headline */}
            <View style={s.eyebrowRow}>
              <Text style={s.eyebrow} numberOfLines={1}>
                {(e.category === "deal" ? "Deal" : CATEGORY[e.category].label).toUpperCase()}{addr.area ? `  ·  ${addr.area.toUpperCase()}` : ""}
              </Text>
              {e.partner && (
                <View style={s.partner}><Ionicons name="checkmark-circle" size={12} color={C.accent} /><Text style={s.partnerText}>Yelo partner</Text></View>
              )}
            </View>
            <Text style={s.title} numberOfLines={2}>{e.venue}</Text>
            <Text style={s.sub}>{source}{fare ? "  ·  Fares are estimates" : ""}</Text>

            {/* The bill: what's on */}
            <Card>
              <View style={s.cardHead}>
                <View style={s.labelRow}><View style={s.accentDot} /><Text style={s.label}>{isRecurring(e) ? "The deal" : "On the bill"}</Text></View>
                {!isRecurring(e) && e.start && <View style={s.tag}><Text style={s.tagText}>{whenLabel(e).split(" · ").pop()}</Text></View>}
              </View>
              <Text style={s.bill}>{e.title}</Text>
              {!!e.description && <Text style={s.desc}>{e.description}</Text>}
            </Card>

            {/* Logistics */}
            <Card padded={false}>
              <InfoRow icon="time-outline" title={whenLabel(e)} subtitle={e.price ? `Tickets ${e.price}` : CATEGORY[e.category].label} />
              <InfoRow icon="location-outline" title={addr.street} subtitle={addr.rest}
                action={{ label: "Directions", onPress: () => Linking.openURL(config.directionsUrl(`${e.venue}, ${e.address}`)) }} />
              {fare ? (
                <InfoRow icon="car-outline" title={`About $${fare.yelo} with Yelo`} last
                  subtitle={`Uber/Lyft ~$${fare.typical}  ·  ${fare.miles < 0.95 ? fare.miles.toFixed(1) : Math.round(fare.miles)} mi  ·  ~${fare.minutes} min`} />
              ) : canAskLocation ? (
                <InfoRow icon="car-outline" title="See your ride price" subtitle="Yelo vs. Uber/Lyft from where you are" last
                  action={{ label: "Use location", onPress: onAskLocation }} />
              ) : (
                <InfoRow icon="car-outline" title="Ride there with Yelo" subtitle="Turn on location to see the price" last />
              )}
            </Card>

            {/* Who's going: turn one person's plan into a group */}
            <Card>
              <View style={s.cardHead}>
                <View style={s.goingRow}>
                  {people.length > 0 ? (
                    <View style={s.faces}>
                      {people.slice(0, 3).map((m, i) => (
                        <View key={i} style={[s.face, { marginLeft: i ? -8 : 0, zIndex: 3 - i }, m.status === "on_way" && s.faceOnWay]}>
                          <Text style={[s.faceText, m.status === "on_way" && { color: C.onAccent }]}>{m.me ? "You" : initials(m.name)}</Text>
                        </View>
                      ))}
                      {people.length > 3 && <View style={[s.face, { marginLeft: -8 }]}><Text style={s.faceText}>+{people.length - 3}</Text></View>}
                    </View>
                  ) : (
                    <View style={s.face}><Ionicons name="people" size={12} color={C.ink3} /></View>
                  )}
                  <Text style={s.goingText} numberOfLines={1}>
                    {going ? <Text style={s.goingStrong}>{going} going</Text> : "Be the first to go"}
                    {isGoing && going > 1 ? "  ·  including you" : ""}
                  </Text>
                </View>
                {crew && <Text style={s.label}>Your crew</Text>}
              </View>
              <View style={s.segment}>
                <Tap style={[s.segBtn, isGoing && s.segOn]} disabled={isGoing} accessibilityState={{ selected: isGoing }}
                  onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onGo(e); }}>
                  <Ionicons name={isGoing ? "checkmark" : "hand-right-outline"} size={15} color={isGoing ? C.accent : C.ink2} />
                  <Text style={[s.segText, isGoing && { color: C.ink }]}>{isGoing ? "Going" : "I'm going"}</Text>
                </Tap>
                {canCrew && !crew && (
                  <Tap style={[s.segBtn, composing && s.segOn]} onPress={() => { Haptics.selectionAsync(); setComposing((c) => !c); }}
                    accessibilityState={{ expanded: composing }}>
                    <Ionicons name="people-outline" size={15} color={composing ? C.ink : C.ink2} />
                    <Text style={[s.segText, composing && { color: C.ink }]}>Heading out</Text>
                  </Tap>
                )}
                <Tap style={[s.segBtn, s.segIcon]} onPress={share} accessibilityLabel="Invite friends">
                  <Ionicons name="paper-plane-outline" size={15} color={C.ink2} />
                </Tap>
              </View>
              {composing && !crew && (
                <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: 12 }}>
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
                <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: 12 }}>
                  <CrewCard crew={crew} onStatus={onCrewStatus} onRide={ride} />
                </Animated.View>
              )}
            </Card>

            {/* The deal: hidden until unlocked, then shown big enough to hold up at the door */}
            {e.deal && (
              <Tap pressedScale={unlocked ? 1 : 0.99} disabled={unlocked} onPress={unlock} style={s.perk}
                accessibilityLabel={unlocked ? `Your deal: ${e.deal}` : "Unlock the Scout deal"}>
                <View style={s.perkIcon}><Ionicons name={unlocked ? "ticket" : "gift-outline"} size={16} color={C.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.perkTitle}>{unlocked ? "Your deal" : "Scout deal"}</Text>
                  <Text style={unlocked ? s.perkDeal : s.perkSub}>{unlocked ? e.deal : "Unlock it, then show it at the door or bar."}</Text>
                </View>
                {!unlocked && <Text style={s.perkAction}>Unlock</Text>}
              </Tap>
            )}
          </View>
        </ScrollView>

        {/* Docked actions: Ride dominates; the second action is quieter */}
        <View pointerEvents="box-none" style={[s.dock, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0)", "rgba(12,12,10,0.92)", C.bg]} locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFill} />
          <Tap style={[s.btn, s.btnPrimary]} onPress={ride}>
            <Ionicons name="car" size={18} color={C.onAccent} />
            <Text style={s.btnPrimaryText}>{fare ? `Ride with Yelo · ~$${fare.yelo}` : "Ride with Yelo"}</Text>
          </Tap>
          {e.deal && !unlocked ? (
            <Tap style={[s.btn, s.btnQuiet]} onPress={unlock}>
              <Ionicons name="gift-outline" size={16} color={C.accent} />
              <Text style={s.btnQuietText}>Unlock deal</Text>
            </Tap>
          ) : eventPage ? (
            <Tap style={[s.btn, s.btnQuiet]} onPress={() => Linking.openURL(eventPage)}>
              <Ionicons name="open-outline" size={16} color={C.ink2} />
              <Text style={s.btnQuietText}>Event page</Text>
            </Tap>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function Card({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <View style={[s.card, padded && { padding: 16 }]}>{children}</View>;
}

function InfoRow({ icon, title, subtitle, action, last }: {
  icon: Icon; title: string; subtitle?: string; last?: boolean; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={[s.info, !last && s.infoDivider]}>
      <View style={s.iconTile}><Ionicons name={icon} size={16} color={C.ink2} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.infoTop}>
          <Text style={s.infoTitle} numberOfLines={1}>{title}</Text>
          {action && (
            <Tap onPress={action.onPress} hitSlop={12} accessibilityRole="link"><Text style={s.infoAction}>{action.label}</Text></Tap>
          )}
        </View>
        {!!subtitle && <Text style={s.infoSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.scrim },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: SCREEN_H * 0.92, backgroundColor: C.bg,
    borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: "hidden", ...shadow, shadowOffset: { width: 0, height: -2 } },
  noPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.d1, alignItems: "flex-end", justifyContent: "center", paddingRight: 24 },
  grabber: { position: "absolute", top: 8, alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  heroTop: { position: "absolute", top: 20, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  glass: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(21,21,19,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  heroChips: { position: "absolute", left: 20, bottom: 12, flexDirection: "row", gap: 8 },
  glassChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: R.pill,
    backgroundColor: "rgba(12,12,10,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  glassChipText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink, letterSpacing: 0.3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  content: { paddingHorizontal: 20, gap: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  eyebrow: { flex: 1, fontFamily: F.semibold, fontSize: T.meta, color: C.ink3, letterSpacing: 1.4 },
  partner: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 8, borderRadius: R.pill,
    backgroundColor: ACCENT_TINT, borderWidth: 1, borderColor: ACCENT_EDGE },
  partnerText: { fontFamily: F.semibold, fontSize: T.meta, color: C.accent, letterSpacing: 0.3 },
  title: { fontFamily: F.display, fontSize: T.display + 4, lineHeight: 46, color: C.ink, marginTop: -4 },
  sub: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: -8, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  accentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  label: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink3, letterSpacing: 1.2, textTransform: "uppercase" },
  tag: { height: 22, paddingHorizontal: 8, borderRadius: 6, justifyContent: "center", backgroundColor: C.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  tagText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink2 },
  bill: { fontFamily: F.semibold, fontSize: T.body, lineHeight: 22, color: C.ink },
  desc: { fontFamily: F.regular, fontSize: T.small, lineHeight: 21, color: C.ink2, marginTop: 4 },
  info: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  infoDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hairline },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.fill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  infoTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  infoTitle: { flex: 1, fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  infoSub: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 2 },
  infoAction: { fontFamily: F.semibold, fontSize: T.small, color: C.accent },
  goingRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  faces: { flexDirection: "row" },
  face: { minWidth: 26, height: 26, paddingHorizontal: 2, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: C.d3, borderWidth: 2, borderColor: C.surface },
  faceOnWay: { backgroundColor: C.accent },
  faceText: { fontFamily: F.semibold, fontSize: 10, color: C.ink },
  goingText: { flexShrink: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  goingStrong: { fontFamily: F.semibold, color: C.ink },
  segment: { flexDirection: "row", gap: 8, marginTop: 4 },
  segBtn: { flex: 1, height: 44, borderRadius: R.md, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    backgroundColor: C.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  segOn: { backgroundColor: C.d3, borderColor: C.ink3 },
  segIcon: { flex: 0, width: 48 },
  segText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink2 },
  perk: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: R.lg, backgroundColor: C.surface,
    borderWidth: 1, borderColor: ACCENT_EDGE },
  perkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: ACCENT_TINT,
    borderWidth: 1, borderColor: ACCENT_EDGE },
  perkTitle: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  perkSub: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 2 },
  perkDeal: { fontFamily: F.semibold, fontSize: T.body, lineHeight: 22, color: C.accent, marginTop: 2 },
  perkAction: { fontFamily: F.semibold, fontSize: T.small, color: C.accent, letterSpacing: 0.4 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 28 },
  btn: { height: 52, borderRadius: R.md, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  btnPrimary: { flex: 7, backgroundColor: C.accent },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: T.body, color: C.onAccent },
  btnQuiet: { flex: 5, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  btnQuietText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
