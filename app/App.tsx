import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { API_URL, getEvents, getHealth, isRecurring, nightEnd, runDiscovery, whenLabel, type Category, type YeloEvent } from "./src/api";
import { clusterEvents, coreOf } from "./src/cluster";
import { CATEGORY, color as C, font as F, radius as R, shadow } from "./src/theme";
import { ANDROID_MAP_STYLE } from "./src/mapStyle";
import { Rooms, useLeads } from "./src/Rooms";
import { estimateFare, useMyLocation, type Point } from "./src/fare";

const { width: W } = Dimensions.get("window");
const CARD_W = W - 64;
const GAP = 10;
// Yelo's live markets (joinyelo.com/partner lists venues in both).
const CITIES = ["New York, NY", "Los Angeles, CA"];

const START: Region = { latitude: 40.728, longitude: -73.99, latitudeDelta: 0.09, longitudeDelta: 0.09 };

type Filter = Category | "all" | "tonight";
const FILTERS: Filter[] = ["all", "tonight", ...(Object.keys(CATEGORY) as Category[])];
const filterLabel = (f: Filter) => (f === "all" ? "All" : f === "tonight" ? "Tonight" : CATEGORY[f].label);

// "Tonight" = dated events from now until 6am, plus standing deals (happy hours run every day).
function matches(e: YeloEvent, f: Filter) {
  if (f === "all") return true;
  if (f === "tonight") {
    if (isRecurring(e)) return true;
    if (!e.start) return false;
    const t = Date.parse(e.start);
    return t > Date.now() - 3 * 3600e3 && t < nightEnd();
  }
  return e.category === f;
}

export default function App() {
  const [fontsLoaded] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return fontsLoaded ? <Scout /> : <View style={{ flex: 1, backgroundColor: C.bg }} />;
}

function Scout() {
  const map = useRef<MapView>(null);
  const list = useRef<FlatList<YeloEvent>>(null);
  const [city, setCity] = useState("New York, NY");
  const [events, setEvents] = useState<YeloEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<YeloEvent | null>(null); // highlighted on map + carousel
  const [detail, setDetail] = useState<YeloEvent | null>(null); // open in the sheet
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState<Region>(START);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeCity, setActiveCity] = useState(city); // the city on the map (city is the text field)
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [leads, setLeads] = useLeads(activeCity);
  const me = useMyLocation();
  const [exaReady, setExaReady] = useState(false);
  const toast = useToast();
  const cardsIn = useRef(new Animated.Value(0)).current;

  // Soonest first; recurring deals after dated events.
  const shown = useMemo(() => {
    const t = (e: YeloEvent) => (e.start && !isRecurring(e) ? Date.parse(e.start) : Infinity);
    return events.filter((e) => matches(e, filter)).sort((a, b) => Number(!!b.partner) - Number(!!a.partner) || t(a) - t(b));
  }, [events, filter]);

  // Keep the active pin out of clustering so it's always visible.
  const clusters = useMemo(() => clusterEvents(shown.filter((e) => e.id !== active?.id), region), [shown, active, region]);

  const fit = useCallback((items: YeloEvent[]) => {
    const core = coreOf(items);
    if (!core.length) return;
    map.current?.fitToCoordinates(
      core.map((e) => ({ latitude: e.lat, longitude: e.lng })),
      { edgePadding: { top: 200, right: 40, bottom: 220, left: 40 }, animated: true },
    );
  }, []);

  const showCards = useCallback(() => {
    cardsIn.setValue(0);
    Animated.timing(cardsIn, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [cardsIn]);

  const load = useCallback(async (c: string) => {
    try {
      const [{ exa }, res] = await Promise.all([getHealth(), getEvents(c)]);
      setExaReady(exa);
      setActiveCity(c);
      setEvents(res.events);
      setActive(null);
      if (res.events.length) toast.show(`${res.events.length} spots this week`);
      setTimeout(() => { fit(res.events); showCards(); }, 350);
    } catch {
      toast.show(`Can't reach ${API_URL}`, true);
    }
  }, [fit, showCards, toast]);

  useEffect(() => { load(city); }, []);

  const scout = async () => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast.show(`Searching ${city.split(",")[0]} · about 2 min`, true);
    try {
      const res = await runDiscovery(city);
      setEvents(res.events);
      setFilter("all");
      setActive(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(`${res.added} new spots`);
      fit(res.events);
      showCards();
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const focus = useCallback((e: YeloEvent, opts: { scroll?: boolean } = {}) => {
    setActive(e);
    map.current?.animateCamera({ center: { latitude: e.lat - 0.0025, longitude: e.lng }, zoom: 15 }, { duration: 500 });
    if (opts.scroll) {
      const i = shown.findIndex((x) => x.id === e.id);
      if (i >= 0) list.current?.scrollToOffset({ offset: i * (CARD_W + GAP), animated: true });
    }
  }, [shown]);

  // Swiping the carousel moves the map to the card that settles in view.
  const onSwipe = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(ev.nativeEvent.contentOffset.x / (CARD_W + GAP));
    const e = shown[Math.max(0, Math.min(i, shown.length - 1))];
    if (e && e.id !== active?.id) {
      Haptics.selectionAsync();
      focus(e);
    }
  };

  const pickFilter = (k: Filter) => {
    Haptics.selectionAsync();
    setFilter(k);
    setActive(null);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    fit(events.filter((e) => matches(e, k)));
    showCards();
  };

  const ride = (e: YeloEvent) => {
    // Stand-in for a Yelo ride request: hand off to the phone's maps app.
    const q = encodeURIComponent(`${e.venue}, ${e.address}`);
    const url = Platform.OS === "android" ? `google.navigation:q=${e.lat},${e.lng}` : `maps://?daddr=${q}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
  };

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={START} userInterfaceStyle="light"
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"} customMapStyle={ANDROID_MAP_STYLE}
        showsPointsOfInterests={false} showsCompass={false} toolbarEnabled={false} showsUserLocation={!!me}
        onRegionChangeComplete={setRegion} onPress={() => setActive(null)}>
        {clusters.map((c) =>
          c.events.length === 1 ? (
            <Marker key={c.events[0].id} coordinate={{ latitude: c.lat, longitude: c.lng }} tracksViewChanges={false}
              onPress={(ev) => { ev.stopPropagation(); focus(c.events[0], { scroll: true }); }}>
              <View style={[s.pin, c.events[0].partner && s.pinPartner]}><Ionicons name={CATEGORY[c.events[0].category].icon} size={14} color="#fff" /></View>
            </Marker>
          ) : (
            <Marker key={c.key} coordinate={{ latitude: c.lat, longitude: c.lng }} tracksViewChanges={false}
              onPress={(ev) => { ev.stopPropagation(); fit(c.events); }}>
              <View style={s.cluster}><Text style={s.clusterText}>{c.events.length}</Text></View>
            </Marker>
          ),
        )}
        {active && (
          <Marker key={`active-${active.id}`} coordinate={{ latitude: active.lat, longitude: active.lng }} zIndex={999}
            anchor={{ x: 0.5, y: 0.3 }} onPress={(ev) => { ev.stopPropagation(); setDetail(active); }}>
            <View style={{ alignItems: "center" }}>
              <View style={s.pinActive}><Ionicons name={CATEGORY[active.category].icon} size={20} color={C.ink} /></View>
              <View style={s.pinLabel}><Text style={s.pinLabelText} numberOfLines={1}>{active.venue}</Text></View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Header over a soft fade so map labels don't fight the search bar */}
      <LinearGradient pointerEvents="none" colors={["rgba(250,248,242,0.98)", "rgba(250,248,242,0.8)", "rgba(250,248,242,0)"]}
        locations={[0, 0.55, 1]} style={s.headerFade} />
      <View style={s.top}>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Ionicons name="location-outline" size={18} color={C.ink2} />
            <TextInput value={city} onChangeText={setCity} onSubmitEditing={() => load(city)} placeholder="Search a city"
              placeholderTextColor={C.ink3} style={s.searchInput} returnKeyType="search" selectTextOnFocus
              onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} />
          </View>
          <Pressable onPress={scout} disabled={busy || !exaReady}
            style={({ pressed }) => [s.scoutBtn, !exaReady && { opacity: 0.4 }, pressed && s.pressed]}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.scoutText}>Scout</Text>}
          </Pressable>
        </View>
        {editing && (
          <View style={s.suggest}>
            {CITIES.map((c) => (
              <Pressable key={c} style={({ pressed }) => [s.suggestRow, pressed && { backgroundColor: C.fill }]}
                onPress={() => { setCity(c); setEditing(false); Keyboard.dismiss(); load(c); }}>
                <Ionicons name="navigate-outline" size={16} color={C.ink2} />
                <Text style={s.suggestText}>{c}</Text>
                <Text style={s.suggestHint}>Yelo city</Text>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {FILTERS.map((k) => (
            <Pressable key={k} onPress={() => pickFilter(k)} style={[s.chip, filter === k && s.chipOn]}>
              <Text style={[s.chipText, filter === k && s.chipTextOn]}>{filterLabel(k)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <toast.View />

      {!shown.length && !busy && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>{events.length ? "Nothing here yet" : `No spots in ${city.split(",")[0]} yet`}</Text>
          <Text style={s.emptySub}>
            {events.length ? "Try another filter." : exaReady
              ? "Tap Scout to find this week's events and deals."
              : "Add an Exa key on the server to scout this city."}
          </Text>
        </View>
      )}

      {/* Carousel synced with the map */}
      <Animated.View style={[s.carousel, {
        opacity: cardsIn,
        transform: [{ translateY: cardsIn.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
      }]}>
        <FlatList ref={list} data={shown} keyExtractor={(e) => e.id} horizontal showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + GAP} decelerationRate="fast" disableIntervalMomentum
          contentContainerStyle={{ gap: GAP, paddingHorizontal: (W - CARD_W) / 2 }}
          onMomentumScrollEnd={onSwipe}
          renderItem={({ item: e }) => (
            <Pressable onPress={() => (active?.id === e.id ? setDetail(e) : focus(e, { scroll: true }))}
              style={({ pressed }) => [s.card, pressed && s.pressed]}>
              <View style={s.cardTop}>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {CATEGORY[e.category].label}  ·  {whenLabel(e)}
                </Text>
                {e.partner ? <View style={s.partnerTag}><Text style={s.partnerTagText}>Yelo partner</Text></View>
                  : e.deal ? <View style={s.dealTag}><Text style={s.dealTagText}>Deal</Text></View> : null}
              </View>
              <Text style={s.cardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{e.venue}</Text>
              <Text style={s.cardSub} numberOfLines={1}>{e.deal ?? e.title}</Text>
            </Pressable>
          )} />
      </Animated.View>

      {/* Partner-team entry point: venues that could host a Yelo night */}
      <Animated.View style={[s.roomsPillWrap, { opacity: cardsIn }]}>
        <Pressable onPress={() => { Haptics.selectionAsync(); setRoomsOpen(true); }}
          style={({ pressed }) => [s.roomsPill, pressed && s.pressed]}>
          <Ionicons name="business-outline" size={14} color={C.ink} />
          <Text style={s.roomsPillText}>Rooms for Yelo nights{leads.length ? `  ·  ${leads.length}` : ""}</Text>
        </Pressable>
      </Animated.View>

      <Rooms visible={roomsOpen} city={activeCity} leads={leads} setLeads={setLeads} canSearch={exaReady}
        onClose={() => setRoomsOpen(false)} />

      <DetailSheet event={detail} me={me} unlocked={!!detail && unlocked.has(detail.id)}
        onUnlock={(e) => setUnlocked((u) => new Set(u).add(e.id))} onRide={ride} onClose={() => setDetail(null)} />
    </View>
  );
}

// Bottom sheet modeled on Yelo's spot card: venue, details, Ride + Unlock.
function DetailSheet({ event: e, me, unlocked, onUnlock, onRide, onClose }: {
  event: YeloEvent | null; me: Point | null; unlocked: boolean;
  onUnlock: (e: YeloEvent) => void; onRide: (e: YeloEvent) => void; onClose: () => void;
}) {
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => { reveal.setValue(unlocked ? 1 : 0); }, [e?.id]);
  const fare = e && me ? estimateFare(me, { lat: e.lat, lng: e.lng }) : null;

  const unlock = () => {
    if (!e) return;
    onUnlock(e);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(reveal, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
  };

  return (
    <Modal visible={!!e} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      {e && (
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.sheetEyebrow}>{e.partner ? "Yelo partner  ·  " : ""}{CATEGORY[e.category].label}</Text>
          <Text style={s.sheetTitle} numberOfLines={2}>{e.venue}</Text>
          <Text style={s.sheetEvent}>{e.title}</Text>
          {!!e.description && <Text style={s.sheetDesc}>{e.description}</Text>}

          <View style={s.rows}>
            <Row icon="time-outline" text={whenLabel(e)} />
            <Row icon="location-outline" text={e.address} />
            {e.price && <Row icon="ticket-outline" text={e.price} />}
            {fare && (
              <Row icon="car-outline"
                text={`${fare.miles < 0.95 ? fare.miles.toFixed(1) : Math.round(fare.miles)} mi · about $${fare.yelo} with Yelo (Uber/Lyft ~$${fare.typical})`} />
            )}
          </View>

          {e.deal && unlocked && (
            <Animated.View style={[s.dealCard, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
              <Text style={s.dealLabel}>Your deal</Text>
              <Text style={s.dealText}>{e.deal}</Text>
              <Text style={s.dealHint}>Show this at the door or bar.</Text>
            </Animated.View>
          )}

          <View style={s.actions}>
            <Pressable style={({ pressed }) => [s.btn, s.btnPrimary, pressed && s.pressed]} onPress={() => onRide(e)}>
              <Ionicons name="car-outline" size={18} color={C.ink} />
              <Text style={s.btnPrimaryText}>{fare ? `Ride · ~$${fare.yelo}` : "Ride there"}</Text>
            </Pressable>
            {e.deal ? (
              <Pressable style={({ pressed }) => [s.btn, s.btnDeal, unlocked && { opacity: 0.45 }, pressed && s.pressed]} disabled={unlocked} onPress={unlock}>
                <Text style={s.btnDealText}>{unlocked ? "Unlocked" : "Unlock deal"}</Text>
              </Pressable>
            ) : e.url ? (
              <Pressable style={({ pressed }) => [s.btn, s.btnQuiet, pressed && s.pressed]} onPress={() => Linking.openURL(e.url!)}>
                <Text style={s.btnQuietText}>Event page</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={s.source}>
            {e.source === "demo" ? "Demo listing" : `Found on the web · ${e.confidence} confidence`}
            {fare ? "  ·  Fares are estimates" : ""}
          </Text>
        </View>
      )}
    </Modal>
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

// A small pill under the header that fades in, then out (unless sticky).
function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, sticky = false) => {
    setMsg(text);
    clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (!sticky) timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: true }).start(), 2200);
  }, [opacity]);
  const ToastView = useCallback(() => (
    <Animated.View pointerEvents="none" style={[s.toast, { opacity }]}>
      <Text style={s.toastText}>{msg}</Text>
    </Animated.View>
  ), [msg, opacity]);
  return useMemo(() => ({ show, View: ToastView }), [show, ToastView]);
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  headerFade: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 58 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 16, backgroundColor: C.surface, borderRadius: R.pill, ...shadow },
  searchInput: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  scoutBtn: { height: 48, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", ...shadow },
  scoutText: { fontFamily: F.semibold, fontSize: 15, color: "#fff" },
  suggest: { marginHorizontal: 16, marginTop: 8, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 6, ...shadow },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  suggestText: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  suggestHint: { fontFamily: F.regular, fontSize: 12, color: C.ink3 },
  chips: { gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  chip: { height: 32, paddingHorizontal: 13, justifyContent: "center", borderRadius: R.pill, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hairline },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  chipTextOn: { color: "#fff" },

  toast: { position: "absolute", top: 160, alignSelf: "center", backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  toastText: { fontFamily: F.medium, fontSize: 13, color: "#fff" },

  pin: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.2 },
  pinPartner: { borderColor: C.yellow, borderWidth: 3 },
  pinActive: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.yellow, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.25 },
  pinLabel: { marginTop: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.surface, maxWidth: 180, ...shadow },
  pinLabelText: { fontFamily: F.semibold, fontSize: 12, color: C.ink },
  cluster: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ink, alignItems: "center", justifyContent: "center", ...shadow },
  clusterText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },

  empty: { position: "absolute", left: 16, right: 16, bottom: 36, backgroundColor: C.surface, borderRadius: R.lg, padding: 20, ...shadow },
  emptyTitle: { fontFamily: F.display, fontSize: 26, color: C.ink },
  emptySub: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.ink2, marginTop: 4 },

  roomsPillWrap: { position: "absolute", left: (W - CARD_W) / 2, bottom: 34 + 112 },
  roomsPill: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface, ...shadow },
  roomsPillText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  carousel: { position: "absolute", left: 0, right: 0, bottom: 34 },
  card: { width: CARD_W, backgroundColor: C.surface, borderRadius: R.lg, paddingHorizontal: 18, paddingVertical: 16, ...shadow },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardMeta: { flex: 1, fontFamily: F.medium, fontSize: 12, color: C.ink3 },
  cardTitle: { fontFamily: F.display, fontSize: 28, lineHeight: 32, color: C.ink, marginTop: 4 },
  cardSub: { fontFamily: F.regular, fontSize: 14, color: C.ink2, marginTop: 2 },
  partnerTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.ink },
  partnerTagText: { fontFamily: F.semibold, fontSize: 11, color: C.yellow },
  dealTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.yellow },
  dealTagText: { fontFamily: F.semibold, fontSize: 11, color: C.ink },

  backdrop: { flex: 1, backgroundColor: "rgba(17,17,17,0.2)" },
  sheet: { backgroundColor: C.surface, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.hairline, marginBottom: 18 },
  sheetEyebrow: { fontFamily: F.medium, fontSize: 12, color: C.ink3, letterSpacing: 0.3 },
  sheetTitle: { fontFamily: F.display, fontSize: 40, lineHeight: 44, color: C.ink, marginTop: 2 },
  sheetEvent: { fontFamily: F.semibold, fontSize: 16, color: C.ink, marginTop: 12 },
  sheetDesc: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.ink2, marginTop: 4 },
  rows: { marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hairline },
  rowText: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink },
  dealCard: { marginTop: 18, padding: 16, borderRadius: R.md, backgroundColor: C.blue },
  dealLabel: { fontFamily: F.medium, fontSize: 12, color: "rgba(255,255,255,0.7)" },
  dealText: { fontFamily: F.semibold, fontSize: 17, lineHeight: 24, color: "#fff", marginTop: 4 },
  dealHint: { fontFamily: F.regular, fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  btn: { flex: 1, height: 52, borderRadius: R.pill, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: C.yellow },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: 16, color: C.ink },
  btnDeal: { backgroundColor: C.blue },
  btnDealText: { fontFamily: F.semibold, fontSize: 16, color: "#fff" },
  btnQuiet: { backgroundColor: C.fill },
  btnQuietText: { fontFamily: F.semibold, fontSize: 16, color: C.ink },
  source: { fontFamily: F.regular, fontSize: 12, color: C.ink3, marginTop: 16, textAlign: "center" },
});
