// Top of the map: the city as a title (with a city menu), the Rooms shortcut, and five filters.
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { FILTERS, filterLabel, type Filter } from "../lib/filters";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { HEADER_GAP, HEADER_H } from "../layout";
import { Tap } from "./Tap";
import { lastRun } from "../data/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// "Near me" joins these only once the rider has shared location, like the Near me filter.
const SUGGESTIONS = ["Free", "Late night", "This weekend", "Live music", "Under $20", "Dance", "Drinks"];
const RECENT_KEY = "scout.recentSearches";
// Controls over the map: near-solid d1, so street names don't read through the chip text.
const OVER_MAP = "rgba(21,21,19,0.94)";

// Yelo's live markets (joinyelo.com/partner lists venues in both).
const CITIES = ["New York, NY", "Los Angeles, CA"];

type Props = {
  city: string;
  onCityChange: (city: string) => void;
  onSubmitCity: (city: string) => void;
  onScout: () => void;
  scouting: boolean;
  scoutable: boolean;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onRooms: () => void; // Yelo's partner-team view, kept out of the rider's way
  query: string; onQuery: (q: string) => void; // search within the spots on the map
  savedCount?: number; // a Saved chip appears once something is saved
  canNear?: boolean; // a Near me chip appears once the rider has shared location
};

// The city is the title. Tapping it opens a short menu: Yelo's cities, and (rarely needed)
// running the agent again. Filters sit under it: five, all visible.
export function SearchHeader({ city, onCityChange, onSubmitCity, onScout, scouting, scoutable, filter, onFilter, onRooms, query, onQuery, savedCount = 0, canNear = false }: Props) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(!!query);
  // Recent searches (kept on the phone) come before the fixed suggestions, so repeats are one tap.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { AsyncStorage.getItem(RECENT_KEY).then((r) => r && setRecent(JSON.parse(r))).catch(() => {}); }, []);
  const remember = (q: string) => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return;
    setRecent((cur) => {
      const next = [t, ...cur.filter((x) => x !== t)].slice(0, 3);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const endSearch = () => { remember(query); onQuery(""); setSearching(false); };
  // Shows the agent at work: when Scout last searched this city on its own.
  const [last, setLast] = useState<{ ranAt: string; added: number } | null>(null);
  useEffect(() => { if (open) lastRun(city).then(setLast); }, [open, city]);
  const insets = useSafeAreaInsets();
  const name = city.split(",")[0];

  // Android Back closes the menu first, instead of leaving the app.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setOpen(false); return true; });
    return () => sub.remove();
  }, [open]);
  // Back closes the search too (after the menu), instead of leaving the app.
  useEffect(() => {
    if (!searching || open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onQuery(""); setSearching(false); return true; });
    return () => sub.remove();
  }, [searching, open, onQuery]);

  const pickCity = (c: string) => {
    onCityChange(c);
    setOpen(false);
    onSubmitCity(c);
  };

  return (
    <>
      {/* Soft fade so map labels don't fight the controls */}
      <LinearGradient pointerEvents="none" colors={["rgba(12,12,10,0.96)", "rgba(12,12,10,0.7)", "rgba(12,12,10,0)"]}
        locations={[0, 0.55, 1]} style={[s.fade, { height: insets.top + HEADER_GAP + HEADER_H + 26 }]} />
      {/* Tapping anywhere outside the open menu closes it (and doesn't reach the map). */}
      {open && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={s.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close city menu" />
        </Animated.View>
      )}
      <View style={[s.top, { paddingTop: insets.top + HEADER_GAP }, open && { zIndex: 21, elevation: 21 }]}>
        <View style={s.row}>
          <Tap pressedScale={0.98} onPress={() => setOpen((o) => !o)} style={s.cityBtn} hitSlop={8}
            accessibilityLabel={`City: ${name}. Change city`} accessibilityState={{ expanded: open }}>
            <Text style={s.city} numberOfLines={1}>{name}</Text>
            {scouting ? <ActivityIndicator color={C.ink3} size="small" />
              : <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink3} style={{ marginTop: 6 }} />}
          </Tap>
          <Tap onPress={() => (searching ? endSearch() : setSearching(true))} style={s.roundBtn} hitSlop={4}
            accessibilityLabel={searching ? "Close search" : "Search spots"}>
            <Feather name={searching ? "x" : "search"} size={17} color={C.ink2} />
          </Tap>
          <Tap onPress={onRooms} style={s.iconBtn} hitSlop={4} accessibilityLabel="Rooms for Yelo nights (partner team)">
            <Text style={s.roomsText}>Rooms</Text>
          </Tap>
        </View>

        {searching ? (
          // Search replaces the chips (the filter still applies: "jazz" on Tonight is jazz tonight).
          <>
            <View style={[s.searchBox, open && { opacity: 0 }]}>
              <Feather name="search" size={16} color={C.ink3} />
              <TextInput value={query} onChangeText={onQuery} autoFocus placeholder="Jazz, free, rooftop, under $20"
                placeholderTextColor={C.placeholder} style={s.searchInput} returnKeyType="search" onSubmitEditing={() => remember(query)} autoCorrect={false}
                selectionColor={C.selection} cursorColor={C.accent} accessibilityLabel="Search spots" />
              {!!query && <Tap onPress={() => onQuery("")} hitSlop={12} accessibilityLabel="Clear search"><Feather name="x-circle" size={16} color={C.ink3} /></Tap>}
            </View>
            {!query && !open && (
              // One tap for the searches people make most; they also show what search understands.
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestions} keyboardShouldPersistTaps="handled">
                {[...recent, ...(canNear ? ["Near me"] : []), ...SUGGESTIONS].filter((x, i, all) => all.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i).map((q) => (
                  <Tap key={q} onPress={() => onQuery(q.toLowerCase())} style={s.chip} accessibilityLabel={`Search ${q}`}>
                    <Text style={s.chipText}>{q.charAt(0).toUpperCase() + q.slice(1)}</Text>
                  </Tap>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={open && { opacity: 0 }}
          pointerEvents={open ? "none" : "auto"}>
          {[...FILTERS.slice(0, 1), ...(canNear ? ["near" as Filter] : []), ...FILTERS.slice(1), ...(savedCount > 0 ? ["saved" as Filter] : [])].map((k) => (
            <Tap key={k} onPress={() => onFilter(k)} hitSlop={{ top: 6, bottom: 6 }} style={[s.chip, filter === k && s.chipOn]}
              accessibilityRole="tab" accessibilityState={{ selected: filter === k }}>
              <Text style={[s.chipText, filter === k && s.chipTextOn]}>{k === "saved" ? `Saved · ${savedCount}` : filterLabel(k)}</Text>
            </Tap>
          ))}
        </ScrollView>
        )}

      </View>
      {/* A sibling of the header, not a child: drawn outside the header's bounds, the rows got broken
          accessibility bounds on Android and TalkBack couldn't reach them. */}
      {open && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[s.menu, { top: insets.top + HEADER_GAP + 52 }]}>
          {CITIES.map((c) => (
            <Tap key={c} pressedScale={0.99} style={s.menuRow} onPress={() => pickCity(c)} accessibilityState={{ selected: c === city }}>
              <Text style={[s.menuText, c === city && { color: C.ink }]}>{c.split(",")[0]}</Text>
              {c === city && <Feather name="check" size={18} color={C.ink} />}
            </Tap>
          ))}
          {scoutable && (
            <Tap pressedScale={0.99} style={[s.menuRow, s.menuDivider]} disabled={scouting}
              onPress={() => { setOpen(false); onScout(); }} accessibilityLabel={`Search the web again for ${name}`}>
              <Feather name="refresh-cw" size={16} color={C.ink3} />
              <Text style={[s.menuAction, { flex: 1 }]}>{scouting ? "Searching…" : `Look for new spots in ${name}`}</Text>
              <Text style={s.menuHint}>~2 min</Text>
            </Tap>
          )}
          {last && <Text style={s.lastRun}>{agoLine(last)}</Text>}
        </Animated.View>
      )}
    </>
  );
}

// "Scout searched the web 4 min ago · 2 new"
function agoLine({ ranAt, added }: { ranAt: string; added: number }) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(ranAt)) / 60000));
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `Scout searched the web ${ago}${added ? ` · ${added} new` : ""}`;
}

const s = StyleSheet.create({
  fade: { position: "absolute", top: 0, left: 0, right: 0 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.scrim, zIndex: 20, elevation: 20 },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 48 }, // same 16 gutter as the chips under it
  cityBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flexShrink: 1, fontFamily: F.display, fontSize: T.display, lineHeight: 46, color: C.ink },
  iconBtn: { height: 36, paddingHorizontal: 16, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: OVER_MAP, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  roomsText: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  menu: { position: "absolute", left: 16, right: 16, zIndex: 22, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow, elevation: 22 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 48 },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  menuText: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink2, flex: 1 },
  menuAction: { fontFamily: F.medium, fontSize: T.small, color: C.ink3 },
  lastRun: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  menuHint: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: OVER_MAP, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  // 8 + 44 = 52, the chip row's height, so opening search doesn't move the header.
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: T.body, color: C.ink, paddingVertical: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  suggestions: { gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  chip: { height: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: R.pill, backgroundColor: OVER_MAP,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  chipTextOn: { color: C.bg },
});
