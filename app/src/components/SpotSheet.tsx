// Spot details, edited down: the photo carries the name, one line of facts, what's on, who's
// going, where it is. One place for actions (the dock), one for sharing (top right).
// A real bottom sheet: springs up, drags down to dismiss, backdrop fades with the drag.
import { useEffect, useRef, useState } from "react";
import { BackHandler, Dimensions, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { estimateFare, type Point } from "../lib/fare";
import { openRide } from "../lib/ride";
import { config } from "../config";
import { track } from "../data/activity";
import { inviteMessage } from "../data/social";
import { crewInvite, leaveLabel, type Crew, type CrewStatus } from "../data/crews";
import { HeadingOutSheet } from "./HeadingOutSheet";
import { whenLabel } from "../lib/time";
import { calmCaps, similar } from "../lib/case";
import { goingLine, initials } from "../lib/friends";
import type { Spot } from "../lib/types";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { Tap } from "./Tap";

const SCREEN_H = Dimensions.get("window").height;
const OFFSCREEN = SCREEN_H;
const OPEN = { damping: 24, stiffness: 240, mass: 0.9 };
const HERO_H = 320;

type Props = {
  spot: Spot | null; city: string; me: Point | null; unlocked: boolean;
  canAskLocation: boolean; locationRefused?: boolean; onAskLocation: () => void; // ask for location here, where the ride price explains why
  onUnlock: (spot: Spot) => void; onClose: () => void;
  going: number; isGoing: boolean; onGo: (spot: Spot) => void; // "I'm going" + live count
  onUnGo?: (spot: Spot) => void; // take it back (absent when you're going via a crew)
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


export function SpotSheet({ spot, city, me, unlocked, canAskLocation, locationRefused, onAskLocation, onUnlock, onClose, going, isGoing, onGo, onUnGo,
  crew, canCrew, onStartCrew, onCrewStatus }: Props) {
  const y = useSharedValue(OFFSCREEN);
  const [shown, setShown] = useState<Spot | null>(null); // stays mounted while sliding out
  const [composing, setComposing] = useState(false); // the "Go with friends" sheet is open
  const [more, setMore] = useState(false); // full description

  useEffect(() => {
    if (!spot) return;
    setShown(spot);
    setComposing(false);
    setMore(false);
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
  // Friends by name when your crew is heading here, as on the map cards ("Maya and you · 2 more").
  const crewOthers = crew?.members.filter((m) => !m.me && m.status !== "out").map((m) => m.name) ?? [];
  const crewLine = crewOthers.length
    ? goingLine(going, { others: crewOthers, me: isGoing || !!crew?.members.some((m) => m.me && m.status !== "out") })
    : null;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null); // hooks stay above the early return
  if (!shown) return null;
  const e = shown;
  const fare = me ? estimateFare(me, { lat: e.lat, lng: e.lng }) : null;
  const addr = splitAddress(e.address);
  const people = crew?.members.filter((m) => m.status !== "out") ?? [];
  const meInCrew = crew?.members.find((m) => m.me);
  const ride = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); track(e, "ride", city); openRide(e); };
  const share = async () => {
    const r = await Share.share({ message: crew ? crewInvite(crew) : inviteMessage(e, isGoing) }).catch(() => null);
    if (r?.action === Share.sharedAction) track(e, "share", city);
  };
  // The unlocked deal appears at the end of the sheet, under the fold; bring it into view.
  const unlock = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); track(e, "unlock", city); onUnlock(e);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  };
  // Each fact stays whole when the line wraps ("3 mi away" never splits).
  const facts = [whenLabel(e), e.price && !similar(e.price, e.title) ? e.price : null, fare && `${fare.miles < 0.95 ? fare.miles.toFixed(1) : Math.round(fare.miles)} mi away`].filter(Boolean) as string[];
  const eyebrow = [(e.category === "deal" ? "Deal" : CATEGORY[e.category].label), addr.area].filter(Boolean).join("  ·  ");
  const source = e.source === "venue" ? "Listed by the venue" : e.confidence === "low" ? "Unconfirmed listing, check before you go" : "Found on the web";

  const titleBlock = (
    <>
      <Text style={s.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{e.venue}</Text>
      <View style={s.eyebrowRow}>
        <Text style={s.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        {e.partner && <View style={s.partner}><View style={s.partnerMark} /><Text style={s.partnerText}>Yelo partner</Text></View>}
      </View>
    </>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View style={[s.sheet, sheetStyle]}>
        <ScrollView ref={scroll} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 112 + insets.bottom }}
          showsVerticalScrollIndicator={false} bounces={false}>
          {/* The photo is the header: name and neighborhood set on it, like a magazine cover. */}
          <GestureDetector gesture={drag}>
            <View>
              {e.image ? (
                <View style={{ height: HERO_H }}>
                  <Image source={e.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                  <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0.5)", "rgba(12,12,10,0)", "rgba(12,12,10,0.72)", "rgba(12,12,10,0.96)", C.bg]}
                    locations={[0, 0.22, 0.48, 0.7, 1]} style={StyleSheet.absoluteFill} />
                  <View style={s.heroText}>{titleBlock}</View>
                </View>
              ) : (
                <View style={s.plainHead}>{titleBlock}</View>
              )}
              <View style={s.grabber} />
            </View>
          </GestureDetector>

          <View style={s.content}>
            <View style={s.factsRow}>
              {facts.map((f, i) => (
                <View key={i} style={s.fact}>
                  {i > 0 && <View style={s.factDot} />}
                  <Text style={s.facts} numberOfLines={1}>{f}</Text>
                </View>
              ))}
            </View>

            {calmCaps(e.title).toLowerCase() !== whenLabel(e).toLowerCase() && (
              <Text style={s.bill} numberOfLines={2}>{calmCaps(e.title)}</Text>
            )}
            {!!e.description && (
              <Tap pressedScale={1} onPress={() => setMore((m) => !m)} accessibilityLabel={more ? "Show less" : "Show more"}>
                <Text style={s.desc} numberOfLines={more ? undefined : 2}>{e.description}</Text>
              </Tap>
            )}

            <View style={s.rule} />

            {/* Who's going, and getting your people there */}
            <View style={s.row}>
              {people.length ? (
                <View style={s.faces}>
                  {people.slice(0, 3).map((m, i) => (
                    <View key={i} style={[s.face, { marginLeft: i ? -8 : 0, zIndex: 3 - i }, m.status === "on_way" && s.faceOnWay]}>
                      <Text style={[s.faceText, m.status === "on_way" && { color: C.bg }]}>{m.me ? "You" : initials(m.name)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={[s.rowText, !going && { color: C.ink2, fontFamily: F.medium }]} numberOfLines={1}>
                {crewLine ?? (isGoing && going <= 1 ? "You're going" : going ? `${going} going${isGoing ? ", including you" : ""}` : "No one going yet")}
              </Text>
              <Tap style={[s.pill, isGoing && s.pillOn]} disabled={isGoing && !onUnGo} accessibilityState={{ selected: isGoing }}
                accessibilityHint={isGoing && onUnGo ? "Tap to take it back" : undefined}
                onPress={() => {
                  if (isGoing) { Haptics.selectionAsync(); onUnGo?.(e); return; }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onGo(e);
                }}>
                {isGoing && <Feather name="check" size={14} color={C.ink} />}
                <Text style={[s.pillText, isGoing && { color: C.ink }]}>{isGoing ? "Going" : "I'm going"}</Text>
              </Tap>
            </View>

            {crew ? (
              <Animated.View entering={FadeIn} style={s.crew}>
                <View style={s.crewHead}>
                  <Text style={s.crewLabel}>Your crew</Text>
                  <Text style={s.crewTime}>{leaveLabel(crew.leaveAt)}</Text>
                </View>
                <View style={s.crewMembers}>
                  {crew.members.filter((m) => m.status !== "out").map((m, i) => (
                    <View key={i} style={s.member}>
                      <View style={[s.memberDot, m.status === "on_way" && s.memberDotOn]} />
                      <Text style={s.memberName} numberOfLines={1}>{m.me ? "You" : m.name}</Text>
                      <Text style={s.memberState}>{m.status === "on_way" ? "on the way" : "coming"}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.crewActions}>
                  {meInCrew?.status === "out" ? (
                    <Tap style={[s.crewBtn, s.crewBtnMain]} onPress={() => onCrewStatus(crew.code, "in")}>
                      <Text style={s.crewBtnMainText}>I'm back in</Text>
                    </Tap>
                  ) : meInCrew?.status === "on_way" ? null : (
                    <Tap style={[s.crewBtn, s.crewBtnMain]} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onCrewStatus(crew.code, "on_way"); }}>
                      <Text style={s.crewBtnMainText}>I'm on my way</Text>
                    </Tap>
                  )}
                  {meInCrew?.status !== "out" && (
                    <Tap style={s.crewBtn} onPress={() => onCrewStatus(crew.code, "out")}>
                      <Text style={s.crewBtnText}>Can't make it</Text>
                    </Tap>
                  )}
                </View>
              </Animated.View>
            ) : canCrew ? (
              <Tap style={s.friends} onPress={() => { Haptics.selectionAsync(); setComposing(true); }}>
                <Feather name="users" size={18} color={C.ink2} />
                <Text style={s.friendsText}>Go with friends</Text>
                <Feather name="chevron-right" size={16} color={C.ink3} />
              </Tap>
            ) : null}

            <View style={s.rule} />

            {/* Where */}
            <View style={s.row}>
              <Feather name="map-pin" size={18} color={C.ink2} />
              <View style={{ flex: 1 }}>
                {/* "Building 92, Brooklyn Navy Yard": don't repeat the venue name as the street. */}
                {addr.street.toLowerCase() === e.venue.toLowerCase() && addr.rest ? (
                  <Text style={s.rowText} numberOfLines={2}>{addr.rest}</Text>
                ) : (
                  <>
                    <Text style={s.rowText} numberOfLines={1}>{addr.street}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{addr.rest}</Text>
                  </>
                )}
              </View>
              <Tap onPress={() => Linking.openURL(config.directionsUrl(`${e.venue}, ${e.address}`))} style={s.round} hitSlop={4}
                accessibilityRole="link" accessibilityLabel={`Directions to ${e.venue}`}>
                <Feather name="navigation" size={17} color={C.ink} />
              </Tap>
            </View>
            {/* The ride, read like a receipt line: what on the left, the price on the right */}
            {fare ? (
              <View style={[s.row, s.rowNext]}>
                <Feather name="clock" size={18} color={C.ink2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowText} numberOfLines={1}>About {fare.minutes} min by car</Text>
                  <Text style={s.rowSub} numberOfLines={1}>Estimate. About ${fare.typical} on other apps</Text>
                </View>
                <Text style={s.value}>${fare.yelo}</Text>
              </View>
            ) : canAskLocation ? (
              <View style={[s.row, s.rowNext]}>
                <Feather name="clock" size={18} color={C.ink2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowText} numberOfLines={1}>Ride price</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{locationRefused ? "Location is off for Scout" : "Uses your location once"}</Text>
                </View>
                <Tap onPress={onAskLocation} style={s.smallPill} hitSlop={8} accessibilityLabel="Use my location to see the ride price">
                  <Text style={s.smallPillText}>{locationRefused ? "Try again" : "Show price"}</Text>
                </Tap>
              </View>
            ) : null}

            {e.deal && unlocked && (
              <Animated.View entering={FadeIn} style={s.deal}>
                <Text style={s.dealLabel}>Your deal · show it at the door</Text>
                <Text style={s.dealText}>{e.deal}</Text>
              </Animated.View>
            )}

            <Text style={s.source}>{source}</Text>
          </View>
        </ScrollView>

        {/* Close and share stay pinned to the sheet; inside the scroll they slid up and were sliced at its edge. */}
        {/* Without a photo nothing sits behind the pinned buttons, so scrolled text ran under them; fade it out first. */}
        {!e.image && (
          <LinearGradient pointerEvents="none" colors={[C.bg, C.bg, "rgba(12,12,10,0)"]} locations={[0, 0.55, 1]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 88, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet }} />
        )}
        {/* The fade covers the handle; draw it again on top (the one underneath still takes the drag). */}
        {!e.image && <View pointerEvents="none" style={s.grabber} />}
        <View pointerEvents="box-none" style={s.heroTop}>
          <Tap style={s.glass} onPress={close} accessibilityLabel="Close"><Feather name="chevron-down" size={18} color={C.ink} /></Tap>
          <Tap style={s.glass} onPress={share} accessibilityLabel={crew ? "Invite friends to your crew" : "Send this spot to a friend"}>
            <Feather name="share" size={17} color={C.ink} />
          </Tap>
        </View>

        {/* The one place for actions */}
        <View pointerEvents="box-none" style={[s.dock, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0)", "rgba(12,12,10,0.94)", C.bg, C.bg]} locations={[0, 0.2, 0.4, 1]}
            style={StyleSheet.absoluteFill} />
          <Tap style={[s.btn, s.btnPrimary]} onPress={ride}>
            <Text style={s.btnPrimaryText}>{fare ? `Ride with Yelo  ·  ~$${fare.yelo}` : "Ride with Yelo"}</Text>
          </Tap>
          {e.deal && !unlocked && (
            <Tap style={[s.btn, s.btnQuiet]} onPress={unlock}>
              <Text style={s.btnQuietText}>Deal</Text>
            </Tap>
          )}
        </View>
      </Animated.View>

      <HeadingOutSheet spot={e} visible={composing} onClose={() => setComposing(false)} onStart={async (leaveAt, name) => {
        const code = await onStartCrew(e, leaveAt, name);
        setComposing(false);
        if (!isGoing) onGo(e);
        track(e, "share", city);
        setTimeout(() => {
          Share.share({ message: crewInvite({ venue: e.venue, title: e.title, leaveAt: leaveAt.toISOString(), code }) }).catch(() => {});
        }, 400); // let the sheet slide away before the share sheet comes up
      }} />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.scrim },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: SCREEN_H * 0.92, backgroundColor: C.bg,
    borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: "hidden", ...shadow, shadowOffset: { width: 0, height: -2 } },
  grabber: { position: "absolute", top: 8, alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" },
  heroTop: { position: "absolute", top: 20, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  glass: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(21,21,19,0.7)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  heroText: { position: "absolute", left: 20, right: 20, bottom: 4 },
  plainHead: { paddingTop: 76, paddingHorizontal: 20 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { flexShrink: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  partnerMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  partner: { flexDirection: "row", alignItems: "center", gap: 6, height: 22, paddingHorizontal: 8, borderRadius: R.pill, justifyContent: "center", backgroundColor: "rgba(21,21,19,0.82)", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  partnerText: { fontFamily: F.semibold, fontSize: 11, color: C.ink, letterSpacing: 0.2 },
  title: { fontFamily: F.display, fontSize: 48, lineHeight: 52, color: C.ink, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  factsRow: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  fact: { flexDirection: "row", alignItems: "center", maxWidth: "100%" },
  factDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.ink3, marginHorizontal: 10 },
  facts: { flexShrink: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  bill: { fontFamily: F.semibold, fontSize: T.body, lineHeight: 23, color: C.ink, marginTop: 20 },
  desc: { fontFamily: F.regular, fontSize: T.small, lineHeight: 21, color: C.ink3, marginTop: 6 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairline, marginVertical: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  rowSub: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 2 },
  faces: { flexDirection: "row" },
  face: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: C.d3, borderWidth: 2, borderColor: C.bg },
  faceOnWay: { backgroundColor: C.ink },
  faceText: { fontFamily: F.semibold, fontSize: 10, color: C.ink },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: 16, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.d4 },
  pillOn: { borderColor: C.d4, backgroundColor: C.surface },
  pillText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink2 },
  friends: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, marginTop: 8 },
  friendsText: { flex: 1, fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  crew: { marginTop: 16, padding: 16, borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, gap: 12 },
  crewHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  crewLabel: { fontFamily: F.medium, fontSize: T.small, color: C.ink3 },
  crewTime: { fontFamily: F.display, fontSize: 22, color: C.ink },
  crewMembers: { gap: 8 },
  member: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.ink3 },
  memberDotOn: { backgroundColor: C.ink, borderColor: C.ink },
  memberName: { flex: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink },
  memberState: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3 },
  crewActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  crewBtn: { flex: 1, height: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  crewBtnMain: { backgroundColor: C.ink, borderColor: C.ink },
  crewBtnMainText: { fontFamily: F.semibold, fontSize: T.small, color: C.bg },
  crewBtnText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink2 },
  crewNote: { flex: 1, fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  link: { fontFamily: F.semibold, fontSize: T.small, color: C.ink, textDecorationLine: "underline" },
  linkQuiet: { fontFamily: F.semibold, fontSize: T.small, color: C.ink3 },
  rowNext: { marginTop: 16 },
  value: { fontFamily: F.semibold, fontSize: T.body, color: C.ink, fontVariant: ["tabular-nums"] },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  smallPill: { height: 32, paddingHorizontal: 12, borderRadius: R.pill, justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  smallPillText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  deal: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  dealLabel: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3 },
  dealText: { fontFamily: F.semibold, fontSize: T.body, lineHeight: 23, color: C.ink, marginTop: 4 },
  source: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 24 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 28 },
  btn: { height: 54, borderRadius: R.pill, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnPrimary: { flex: 1, backgroundColor: C.accent },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: T.body, color: C.onAccent },
  btnQuiet: { backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  btnQuietText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
