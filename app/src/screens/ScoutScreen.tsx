// The main screen: map of spots, search + filters on top, cards along the bottom.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { ScoutMap, type Region, type ScoutMapRef } from "../map/ScoutMap";
import { clusterEvents, coreOf } from "../lib/cluster";
import { matches, sortSpots, type Filter } from "../lib/filters";
import { canonicalCity } from "../lib/cities";
import type { Spot } from "../lib/types";
import { useSpots } from "../hooks/useSpots";
import { useLeads } from "../hooks/useLeads";
import { useMyLocation } from "../hooks/useMyLocation";
import { useGoing } from "../hooks/useGoing";
import { useCrews } from "../hooks/useCrews";
import { openRide } from "../lib/ride";
import { newIds } from "../lib/fresh";
import { isOffline, onNetworkChange } from "../lib/net";
import { friendlyError } from "../lib/report";
import { track } from "../data/activity";
import { useToast } from "../hooks/useToast";
import { SearchHeader } from "../components/SearchHeader";
import { SpotPins } from "../components/SpotPins";
import { SpotCarousel, type CarouselRef } from "../components/SpotCarousel";
import { SpotSheet } from "../components/SpotSheet";
import { EmptyCard, LoadingCard } from "../components/BottomStates";
import { Toast } from "../components/Toast";
import { OfflineBanner } from "../components/OfflineBanner";
import { FirstRunHint } from "../components/FirstRunHint";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "../components/Tap";
import { RoomsScreen } from "./RoomsScreen";
import { CrewsScreen } from "./CrewsScreen";
import { CARD_H, CARD_INSET, CAROUSEL_BOTTOM, HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";

// Share of the map height covered by the bottom pills + cards.
const BOTTOM_BAND = (CAROUSEL_BOTTOM + CARD_H + 56) / Dimensions.get("window").height;
// ...and by the header (status bar + city title + chips).
const TOP_BAND = (HEADER_GAP + HEADER_H + 40) / Dimensions.get("window").height;

const START: Region = { latitude: 40.728, longitude: -73.99, latitudeDelta: 0.09, longitudeDelta: 0.09 };
const FIT_PADDING = { top: 200, right: 40, bottom: 220, left: 40 };

export function ScoutScreen() {
  const map = useRef<ScoutMapRef>(null);
  const carousel = useRef<CarouselRef>(null);
  const { city: mapCity, spots, loading, scouting, scoutable, load, scout } = useSpots();
  const [leads, setLeads] = useLeads(mapCity);
  const { me, canAsk: canAskLocation, ask: askLocation } = useMyLocation();
  const { toast, show } = useToast();
  const { counts: going, mine: myGoing, go, unGo } = useGoing(spots, mapCity);
  const crewsApi = useCrews();
  const insets = useSafeAreaInsets();
  const [crewsOpen, setCrewsOpen] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  // A crew link opened on a phone with Scout (scout://crew/<code>) lands on Crews, code filled in.
  useEffect(() => {
    const handle = (url?: string | null) => {
      const m = url && /^scout:\/\/crew\/([a-f0-9]{8,16})/i.exec(url);
      if (m) { setLinkCode(m[1].toLowerCase()); setCrewsOpen(true); }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, []);
  // Crews still on (anyone not out), for the pill count.
  const spotPhotos = useMemo(() => Object.fromEntries(spots.map((e) => [e.id, e.image])), [spots]);
  const liveCrews = crewsApi.crews.filter((c) => c.members.some((m) => m.me && m.status !== "out"));

  const [cityInput, setCityInput] = useState("New York, NY");
  const [filter, setFilter] = useState<Filter>("tonight"); // Principle 1: open on tonight
  const [region, setRegion] = useState<Region>(START);
  const [active, setActive] = useState<Spot | null>(null); // highlighted on map + carousel
  const [detail, setDetail] = useState<Spot | null>(null); // open in the sheet
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [roomsOpen, setRoomsOpen] = useState(false);

  const shown = useMemo(() => sortSpots(spots.filter((e) => matches(e, filter))), [spots, filter]);
  // The active pin and Yelo partners never fold into a cluster: partners are the rooms Yelo
  // wants people riding to, so their yellow-ringed pins stay visible at every zoom.
  const clusters = useMemo(() => {
    const rest = shown.filter((e) => e.id !== active?.id);
    const partners = rest.filter((e) => e.partner).map((e) => ({ key: e.id, lat: e.lat, lng: e.lng, events: [e] }));
    // Pins that would land behind the bottom pills and cards are noise: hide them (the cards list them anyway).
    const south = region.latitude - region.latitudeDelta / 2, north = region.latitude + region.latitudeDelta / 2;
    const low = south + region.latitudeDelta * BOTTOM_BAND, high = north - region.latitudeDelta * TOP_BAND;
    return [...clusterEvents(rest.filter((e) => !e.partner), region), ...partners].filter((c) => c.lat > low && c.lat < high);
  }, [shown, active, region]);

  const fit = useCallback((list: Spot[]) => {
    const core = coreOf(list);
    if (core.length) map.current?.fitTo(core.map((e) => ({ latitude: e.lat, longitude: e.lng })), FIT_PADDING);
  }, []);

  // While the camera flies to a new city, its tiles are still loading: hold the pins so they
  // don't float on a black map, then bring them in once the ground is drawn.
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // first found in the last 24h
  const [loadFailed, setLoadFailed] = useState(false); // the last load never reached the server
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useCallback((ms: number) => {
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), ms);
  }, []);

  const open = useCallback(async (typed: string) => {
    const city = canonicalCity(typed); // "nyc" and "New York, NY" are the same map
    if (!city) { setCityInput(mapCity ?? "New York, NY"); return; } // empty search: keep the current city
    setCityInput(city);
    setActive(null);
    try {
      const list = await load(city);
      setLoadFailed(false);
      // Open on tonight; on a quiet night (fewer than 3 things on), show the week instead.
      const tonight = list.filter((e) => matches(e, "tonight")).length;
      setFilter(tonight >= 3 ? "tonight" : "all");
      const found = newIds(list);
      setFresh(found);
      const lead = tonight >= 3 ? `${tonight} things on tonight` : `${list.length} spots this week`;
      if (list.length) show(found.size ? `${lead}  ·  ${found.size} new` : lead);
      if (city !== mapCity) settle(1800);
      setTimeout(() => fit(list), 300);
    } catch (err) {
      setLoadFailed(true);
      // Offline already has its own banner; a toast on top of it just collides.
      if (!isOffline()) show(friendlyError(err, "Couldn't load spots"), true);
    }
  }, [load, fit, show, mapCity, settle]);

  useEffect(() => { open(cityInput); }, []);
  // Back online after a failed load: try again on its own instead of leaving an empty map.
  useEffect(() => onNetworkChange((offline) => { if (!offline && loadFailed) open(cityInput); }), [loadFailed, cityInput, open]);

  const runScout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const city = canonicalCity(cityInput);
    if (!city) { show("Type a city to scout first."); return; }
    setCityInput(city);
    show(`Searching ${city.split(",")[0]} · about 2 min`, true);
    try {
      const { list, added, pending } = await scout(city);
      if (pending) {
        // The run outlived our wait; it keeps going on the server. Check back once it's had time.
        show("Still scouting. New spots will appear in a minute.");
        setTimeout(() => open(city), 60_000);
        return;
      }
      setFilter("all");
      setActive(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      show(added ? `${added} new spots` : "Up to date. No new spots this time.");
      fit(list);
    } catch (err) {
      show(friendlyError(err, "Couldn't start the search. Try again in a moment."));
    }
  };

  const focus = useCallback((e: Spot, scroll = false) => {
    setActive(e);
    map.current?.flyTo({ latitude: e.lat - 0.0025, longitude: e.lng }, 15);
    if (scroll) {
      const i = shown.findIndex((x) => x.id === e.id);
      if (i >= 0) carousel.current?.scrollTo(i);
    }
  }, [shown]);

  // Several nights at one venue share a coordinate, so zooming never splits them apart.
  // If a cluster is really one place, select its first spot. The selected spot leaves the cluster,
  // so tapping what's left selects the next one: repeated taps step through that venue's nights.
  const openCluster = (list: Spot[]) => {
    const lats = list.map((e) => e.lat), lngs = list.map((e) => e.lng);
    const spreadKm = Math.hypot((Math.max(...lats) - Math.min(...lats)) * 111, (Math.max(...lngs) - Math.min(...lngs)) * 85);
    if (spreadKm > 0.04) return fit(list);
    const first = sortSpots(list)[0];
    Haptics.selectionAsync();
    focus(first, true);
    if (list.length > 1) show(`${list.length} spots here · tap again for the next`);
  };

  const pickFilter = (f: Filter) => {
    Haptics.selectionAsync();
    setFilter(f);
    setActive(null);
    carousel.current?.scrollTo(0, false);
    fit(spots.filter((e) => matches(e, f)));
  };

  const cityName = cityInput.split(",")[0];

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScoutMap ref={map} initialRegion={START} showsUserLocation={!!me} onRegionChange={setRegion} onPress={() => setActive(null)}>
        <SpotPins clusters={settling ? [] : clusters} active={settling ? null : active}
          onSpot={(e) => focus(e, true)} onCluster={openCluster} onActive={setDetail} />
      </ScoutMap>

      {/* Soft fade under the bottom controls, so pins don't fight the pills and cards (mirrors the header fade). */}
      <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0)", "rgba(12,12,10,0.72)", "rgba(12,12,10,0.94)"]}
        locations={[0, 0.45, 1]} style={[s.bottomFade, { height: CAROUSEL_BOTTOM + CARD_H + 72 }]} />

      <SearchHeader city={cityInput} onCityChange={setCityInput} onSubmitCity={open}
        onScout={runScout} scouting={scouting} scoutable={scoutable} filter={filter} onFilter={pickFilter}
        onRooms={() => { Haptics.selectionAsync(); setRoomsOpen(true); }} />

      <OfflineBanner top={insets.top} />
      <FirstRunHint top={insets.top} city={cityInput} dismissed={!!detail || !!active} />
      <Toast text={toast.text} visible={toast.visible} />

      {loading && !spots.length ? <LoadingCard /> : !shown.length && !scouting ? (
        <EmptyCard
          title={loadFailed ? "Couldn't load spots" : spots.length ? "Nothing here yet" : `No spots in ${cityName} yet`}
          body={loadFailed ? "Check your connection. Scout will try again as soon as you're back online."
            : spots.length ? "Try This week, or another filter."
            : scoutable ? `Open the ${cityName} menu and choose "Look for new spots".` : "New spots usually appear within the hour."} />
      ) : (
        <>
          <Animated.View entering={FadeIn.delay(150)} style={s.roomsWrap}>
            {crewsApi.available && (
              <Tap hitSlop={4} style={[s.rooms, liveCrews.length > 0 && s.crewsOn]} onPress={() => { Haptics.selectionAsync(); setCrewsOpen(true); }}>
                <Text style={[s.roomsText, liveCrews.length > 0 && s.crewsOnText]}>Crews{liveCrews.length ? `  ·  ${liveCrews.length}` : ""}</Text>
              </Tap>
            )}
          </Animated.View>
          <SpotCarousel ref={carousel} spots={shown} fresh={fresh} going={going} activeId={active?.id ?? null}
            onSettle={(e) => { Haptics.selectionAsync(); focus(e); }}
            onPress={(e) => (active?.id === e.id ? setDetail(e) : focus(e, true))}
            onRide={(e) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); track(e, "ride", mapCity ?? cityInput); openRide(e); }} />
        </>
      )}

      <CrewsScreen visible={crewsOpen} crews={crewsApi.crews} photos={spotPhotos} linkCode={linkCode} onJoin={crewsApi.join} onStatus={crewsApi.status}
        onRide={(c) => openRide(c)} onClose={() => setCrewsOpen(false)}
        onOpen={(c) => {
          const spot = spots.find((e) => e.id === c.spotId);
          setCrewsOpen(false);
          if (!spot) { show(`${c.venue} is in another city's map`); return; }
          focus(spot, true);
          setTimeout(() => setDetail(spot), 350);
        }} />

      <RoomsScreen visible={roomsOpen} city={mapCity ?? cityInput} leads={leads} setLeads={setLeads} canSearch={scoutable}
        onClose={() => setRoomsOpen(false)} />

      <SpotSheet spot={detail} city={mapCity ?? cityInput} me={me} canAskLocation={canAskLocation} onAskLocation={askLocation} unlocked={!!detail && unlocked.has(detail.id)}
        onUnlock={(e) => setUnlocked((u) => new Set(u).add(e.id))}
        going={detail ? going[detail.id] ?? 0 : 0} isGoing={!!detail && (myGoing.has(detail.id) || crewsApi.crews.some((c) => c.spotId === detail.id && c.members.some((m) => m.me && m.status !== "out")))} onGo={go}
        onUnGo={detail && myGoing.has(detail.id) && !crewsApi.crews.some((c) => c.spotId === detail.id && c.members.some((m) => m.me && m.status !== "out"))
          ? (e) => { unGo(e); show("You're no longer going"); } : undefined}
        crew={detail ? crewsApi.crews.find((c) => c.spotId === detail.id) : undefined} canCrew={crewsApi.available}
        onStartCrew={(e, leaveAt, name) => crewsApi.start(e, leaveAt, name)} onCrewStatus={crewsApi.status} onClose={() => setDetail(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  roomsWrap: { position: "absolute", left: CARD_INSET, bottom: CAROUSEL_BOTTOM + CARD_H, flexDirection: "row", gap: 8 },
  crewsOn: { backgroundColor: C.ink },
  crewsOnText: { color: C.surface },
  rooms: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.surface, ...shadow },
  roomsText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
