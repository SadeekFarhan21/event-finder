// The main screen: map of spots, search + filters on top, cards along the bottom.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { ScoutMap, type Region, type ScoutMapRef } from "../map/ScoutMap";
import { clusterEvents, coreOf } from "../lib/cluster";
import { matches, sortSpots, type Filter } from "../lib/filters";
import { canonicalCity } from "../lib/cities";
import type { Spot } from "../lib/types";
import { useSpots } from "../hooks/useSpots";
import { useLeads } from "../hooks/useLeads";
import { useMyLocation } from "../hooks/useMyLocation";
import { useToast } from "../hooks/useToast";
import { SearchHeader } from "../components/SearchHeader";
import { SpotPins } from "../components/SpotPins";
import { SpotCarousel, type CarouselRef } from "../components/SpotCarousel";
import { SpotSheet } from "../components/SpotSheet";
import { EmptyCard, LoadingCard } from "../components/BottomStates";
import { Toast } from "../components/Toast";
import { Tap } from "../components/Tap";
import { RoomsScreen } from "./RoomsScreen";
import { CARD_H, CARD_INSET, CAROUSEL_BOTTOM } from "../layout";
import { color as C, font as F, radius as R, shadow } from "../theme";

const START: Region = { latitude: 40.728, longitude: -73.99, latitudeDelta: 0.09, longitudeDelta: 0.09 };
const FIT_PADDING = { top: 200, right: 40, bottom: 220, left: 40 };

export function ScoutScreen() {
  const map = useRef<ScoutMapRef>(null);
  const carousel = useRef<CarouselRef>(null);
  const { city: mapCity, spots, loading, scouting, scoutable, load, scout } = useSpots();
  const [leads, setLeads] = useLeads(mapCity);
  const me = useMyLocation();
  const { toast, show } = useToast();

  const [cityInput, setCityInput] = useState("New York, NY");
  const [filter, setFilter] = useState<Filter>("all");
  const [region, setRegion] = useState<Region>(START);
  const [active, setActive] = useState<Spot | null>(null); // highlighted on map + carousel
  const [detail, setDetail] = useState<Spot | null>(null); // open in the sheet
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [roomsOpen, setRoomsOpen] = useState(false);

  const shown = useMemo(() => sortSpots(spots.filter((e) => matches(e, filter))), [spots, filter]);
  // Keep the active pin out of clustering so it's always visible.
  const clusters = useMemo(() => clusterEvents(shown.filter((e) => e.id !== active?.id), region), [shown, active, region]);

  const fit = useCallback((list: Spot[]) => {
    const core = coreOf(list);
    if (core.length) map.current?.fitTo(core.map((e) => ({ latitude: e.lat, longitude: e.lng })), FIT_PADDING);
  }, []);

  const open = useCallback(async (typed: string) => {
    const city = canonicalCity(typed); // "nyc" and "New York, NY" are the same map
    setCityInput(city);
    setActive(null);
    try {
      const list = await load(city);
      if (list.length) show(`${list.length} spots this week`);
      setTimeout(() => fit(list), 300);
    } catch (err) {
      show((err as Error).message || "Couldn't load spots", true);
    }
  }, [load, fit, show]);

  useEffect(() => { open(cityInput); }, []);

  const runScout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const city = canonicalCity(cityInput);
    setCityInput(city);
    show(`Searching ${city.split(",")[0]} · about 2 min`, true);
    try {
      const { list, added } = await scout(city);
      setFilter("all");
      setActive(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      show(`${added} new spots`);
      fit(list);
    } catch (err) {
      show((err as Error).message);
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
      <StatusBar style="dark" />
      <ScoutMap ref={map} initialRegion={START} showsUserLocation={!!me} onRegionChange={setRegion} onPress={() => setActive(null)}>
        <SpotPins clusters={clusters} active={active}
          onSpot={(e) => focus(e, true)} onCluster={fit} onActive={setDetail} />
      </ScoutMap>

      <SearchHeader city={cityInput} onCityChange={setCityInput} onSubmitCity={open}
        onScout={runScout} scouting={scouting} scoutable={scoutable} filter={filter} onFilter={pickFilter} />

      <Toast text={toast.text} visible={toast.visible} />

      {loading && !spots.length ? <LoadingCard /> : !shown.length && !scouting ? (
        <EmptyCard
          title={spots.length ? "Nothing here yet" : `No spots in ${cityName} yet`}
          body={spots.length ? "Try another filter." : scoutable ? "Tap Scout to find this week's events and deals." : "Add an Exa key on the server to scout this city."} />
      ) : (
        <>
          <Animated.View entering={FadeIn.delay(150)} style={s.roomsWrap}>
            <Tap style={s.rooms} onPress={() => { Haptics.selectionAsync(); setRoomsOpen(true); }}>
              <Ionicons name="business-outline" size={14} color={C.ink} />
              <Text style={s.roomsText}>Rooms for Yelo nights{leads.length ? `  ·  ${leads.length}` : ""}</Text>
            </Tap>
          </Animated.View>
          <SpotCarousel ref={carousel} spots={shown} activeId={active?.id ?? null}
            onSettle={(e) => { Haptics.selectionAsync(); focus(e); }}
            onPress={(e) => (active?.id === e.id ? setDetail(e) : focus(e, true))} />
        </>
      )}

      <RoomsScreen visible={roomsOpen} city={mapCity ?? cityInput} leads={leads} setLeads={setLeads} canSearch={scoutable}
        onClose={() => setRoomsOpen(false)} />

      <SpotSheet spot={detail} me={me} unlocked={!!detail && unlocked.has(detail.id)}
        onUnlock={(e) => setUnlocked((u) => new Set(u).add(e.id))} onClose={() => setDetail(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  roomsWrap: { position: "absolute", left: CARD_INSET, bottom: CAROUSEL_BOTTOM + CARD_H },
  rooms: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: C.surface, ...shadow },
  roomsText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
});
