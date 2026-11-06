// Top of the map: city search, the Scout button, Yelo-city suggestions, and filter chips.
import { useState } from "react";
import { ActivityIndicator, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { FILTERS, filterLabel, type Filter } from "../lib/filters";
import { color as C, font as F, radius as R, shadow } from "../theme";
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
};

export function SearchHeader({ city, onCityChange, onSubmitCity, onScout, scouting, scoutable, filter, onFilter }: Props) {
  const [editing, setEditing] = useState(false);

  const pickCity = (c: string) => {
    onCityChange(c);
    setEditing(false);
    Keyboard.dismiss();
    onSubmitCity(c);
  };

  return (
    <>
      {/* Soft fade so map labels don't fight the controls */}
      <LinearGradient pointerEvents="none" colors={["rgba(250,248,242,0.98)", "rgba(250,248,242,0.75)", "rgba(250,248,242,0)"]}
        locations={[0, 0.55, 1]} style={s.fade} />
      <View style={s.top}>
        <View style={s.row}>
          <Glass style={s.search}>
            <Ionicons name="location-outline" size={18} color={C.ink2} />
            <TextInput value={city} onChangeText={onCityChange} onSubmitEditing={() => onSubmitCity(city)} placeholder="Search a city"
              placeholderTextColor={C.ink3} style={s.input} returnKeyType="search" selectTextOnFocus
              onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} />
          </Glass>
          <Tap onPress={onScout} disabled={scouting || !scoutable} style={[s.scout, !scoutable && { opacity: 0.4 }]}>
            {scouting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.scoutText}>Scout</Text>}
          </Tap>
        </View>

        {editing && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={s.suggest}>
            {CITIES.map((c) => (
              <Tap key={c} pressedScale={0.99} style={s.suggestRow} onPress={() => pickCity(c)}>
                <Ionicons name="navigate-outline" size={16} color={C.ink2} />
                <Text style={s.suggestText}>{c}</Text>
                <Text style={s.suggestHint}>Yelo city</Text>
              </Tap>
            ))}
          </Animated.View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {FILTERS.map((k) => (
            <Tap key={k} onPress={() => onFilter(k)} style={[s.chip, filter === k && s.chipOn]}>
              <Text style={[s.chipText, filter === k && s.chipTextOn]}>{filterLabel(k)}</Text>
            </Tap>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

// Frosted glass on iOS; Android's blur is costly on older devices, so it gets a solid surface.
function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  if (Platform.OS !== "ios") return <View style={[style, { backgroundColor: C.surface }]}>{children}</View>;
  return <BlurView intensity={60} tint="systemChromeMaterialLight" style={[style, { overflow: "hidden" }]}>{children}</BlurView>;
}

const s = StyleSheet.create({
  fade: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 58 },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 16, borderRadius: R.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(17,17,17,0.08)", ...shadow },
  input: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  scout: { height: 48, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", ...shadow },
  scoutText: { fontFamily: F.semibold, fontSize: 15, color: "#fff" },
  suggest: { marginHorizontal: 16, marginTop: 8, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 6, ...shadow },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  suggestText: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  suggestHint: { fontFamily: F.regular, fontSize: 12, color: C.ink3 },
  chips: { gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  chip: { height: 32, paddingHorizontal: 13, justifyContent: "center", borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.hairline },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  chipTextOn: { color: "#fff" },
});
