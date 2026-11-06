// Top of the map: the city as a title (with a city menu), the Rooms shortcut, and five filters.
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { FILTERS, filterLabel, type Filter } from "../lib/filters";
import { color as C, font as F, radius as R, shadow, text as T } from "../theme";
import { HEADER_GAP, HEADER_H } from "../layout";
import { Tap } from "./Tap";

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
};

// The city is the title. Tapping it opens a short menu: Yelo's cities, and (rarely needed)
// running the agent again. Filters sit under it: five, all visible.
export function SearchHeader({ city, onCityChange, onSubmitCity, onScout, scouting, scoutable, filter, onFilter, onRooms }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const name = city.split(",")[0];

  // Android Back closes the menu first, instead of leaving the app.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setOpen(false); return true; });
    return () => sub.remove();
  }, [open]);

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
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="Close city menu" />
        </Animated.View>
      )}
      <View style={[s.top, { paddingTop: insets.top + HEADER_GAP }]}>
        <View style={s.row}>
          <Tap pressedScale={0.98} onPress={() => setOpen((o) => !o)} style={s.cityBtn} hitSlop={8}
            accessibilityLabel={`City: ${name}. Change city`} accessibilityState={{ expanded: open }}>
            <Text style={s.city} numberOfLines={1}>{name}</Text>
            {scouting ? <ActivityIndicator color={C.ink3} size="small" />
              : <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink3} style={{ marginTop: 6 }} />}
          </Tap>
          <Tap onPress={onRooms} style={s.iconBtn} accessibilityLabel="Rooms for Yelo nights (partner team)">
            <Ionicons name="business-outline" size={18} color={C.ink2} />
          </Tap>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={open && { opacity: 0 }}
          pointerEvents={open ? "none" : "auto"}>
          {FILTERS.map((k) => (
            <Tap key={k} onPress={() => onFilter(k)} hitSlop={{ top: 6, bottom: 6 }} style={[s.chip, filter === k && s.chipOn]}
              accessibilityRole="tab" accessibilityState={{ selected: filter === k }}>
              <Text style={[s.chipText, filter === k && s.chipTextOn]}>{filterLabel(k)}</Text>
            </Tap>
          ))}
        </ScrollView>
        {open && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[s.menu, { top: insets.top + HEADER_GAP + 52 }]}>
            {CITIES.map((c) => (
              <Tap key={c} pressedScale={0.99} style={s.menuRow} onPress={() => pickCity(c)} accessibilityState={{ selected: c === city }}>
                <Text style={[s.menuText, c === city && { color: C.ink }]}>{c.split(",")[0]}</Text>
                {c === city && <Ionicons name="checkmark" size={18} color={C.ink} />}
              </Tap>
            ))}
            {scoutable && (
              <Tap pressedScale={0.99} style={[s.menuRow, s.menuDivider]} disabled={scouting}
                onPress={() => { setOpen(false); onScout(); }} accessibilityLabel={`Search the web again for ${name}`}>
                <Ionicons name="refresh" size={16} color={C.ink3} />
                <Text style={[s.menuText, { flex: 1 }]}>{scouting ? "Searching…" : `Look for new spots in ${name}`}</Text>
                <Text style={s.menuHint}>~2 min</Text>
              </Tap>
            )}
          </Animated.View>
        )}

      </View>
    </>
  );
}

const s = StyleSheet.create({
  fade: { position: "absolute", top: 0, left: 0, right: 0 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, height: 48 },
  cityBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flexShrink: 1, fontFamily: F.display, fontSize: 36, lineHeight: 44, color: C.ink },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(21,21,19,0.75)", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  menu: { position: "absolute", left: 16, right: 16, zIndex: 10, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, ...shadow },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 48 },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  menuText: { fontFamily: F.medium, fontSize: T.body, color: C.ink2, flex: 1 },
  menuHint: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3 },
  chips: { gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  chip: { height: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: R.pill, backgroundColor: "rgba(21,21,19,0.75)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  chipTextOn: { color: C.bg },
});
