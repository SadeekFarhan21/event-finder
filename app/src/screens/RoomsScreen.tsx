// "Rooms": the partner-team view. Yelo's playbook is to take a venue's quiet night,
// build an event there and fill it with riders, so this lists rooms worth pitching.
import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "../components/Tap";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { runLeads } from "../data/api";
import type { Lead } from "../lib/types";
import { color as C, font as F, radius as R, text as T } from "../theme";

export function RoomsScreen({ visible, city, leads, setLeads, canSearch, onClose }: {
  visible: boolean; city: string; leads: Lead[]; setLeads: (l: Lead[]) => void; canSearch: boolean; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setLeads(await runLeads(city));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const contact = (l: Lead) => {
    const c = l.contact ?? "";
    if (c.includes("@") && !c.startsWith("@")) return Linking.openURL(`mailto:${c}`);
    if (c.startsWith("@")) return Linking.openURL(`https://instagram.com/${c.slice(1)}`);
    if (/^https?:\/\//.test(c)) return Linking.openURL(c);
    if (l.url) return Linking.openURL(l.url);
  };

  const insets = useSafeAreaInsets();
  // The header scrolls with the list: on a small phone a fixed header left room for ~1.5 cards.
  const header = (
    <View style={[s.head, Platform.OS === "android" && { paddingTop: insets.top + 16 }]}>
      <Tap onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close rooms">
        <Ionicons name="chevron-down" size={22} color={C.ink} />
      </Tap>
      <Text style={s.eyebrow}>For Yelo's partner team · {city.split(",")[0]}</Text>
      <Text style={s.title}>Rooms worth{"\n"}<Text style={s.titleAccent}>pitching.</Text></Text>
      <Text style={s.sub}>
        Independent venues that could host a Yelo night: the vibe, the size, and a night that likely runs quiet.
      </Text>
      <Tap onPress={find} disabled={busy || !canSearch} style={[s.findBtn, !canSearch && { opacity: 0.4 }]}
        accessibilityState={{ busy, disabled: busy || !canSearch }}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.findText}>{leads.length ? "Find more rooms" : "Find rooms"}</Text>}
      </Tap>
      {busy && <Text style={s.hint}>Searching venue sites and calendars · about a minute</Text>}
      {error && <Text style={[s.hint, { color: C.red }]}>{error}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <FlatList data={leads} keyExtractor={(l) => l.id} ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: Math.max(insets.bottom, 16) + 32 }}
          ListEmptyComponent={busy ? undefined : <Text style={s.empty}>No rooms yet. Tap Find rooms to search this city.</Text>}
          renderItem={({ item: l }) => (
            <View style={s.card}>
              <Text style={s.meta} numberOfLines={1}>
                {[l.area, l.kind].filter(Boolean).join("  ·  ")}
              </Text>
              <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{l.venue}</Text>
              <Text style={s.fit} numberOfLines={3}>{l.fit}</Text>
              <View style={s.footer}>
                <View style={s.tags}>
                  {l.quietNight && (
                    <View style={s.night}><Ionicons name="moon-outline" size={13} color={C.ink} /><Text style={s.nightText}>{l.quietNight}</Text></View>
                  )}
                  {l.capacity && (
                    <View style={s.cap}><Ionicons name="people-outline" size={13} color={C.ink2} /><Text style={s.capText}>{l.capacity}</Text></View>
                  )}
                </View>
                {(l.contact || l.url) && (
                  <Tap onPress={() => contact(l)} style={s.contact} accessibilityLabel={`Contact ${l.venue}`}>
                    <Text style={s.contactText}>{l.contact?.includes("@") ? "Contact" : "Website"}</Text>
                    <Ionicons name="arrow-forward" size={14} color={C.ink} />
                  </Tap>
                )}
              </View>
            </View>
          )} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8 },
  close: { alignSelf: "flex-start", width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: C.hairline },
  eyebrow: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3 },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 44, color: C.ink, marginTop: 6 },
  titleAccent: { fontFamily: "InstrumentSerif_400Regular_Italic", color: C.blue },
  sub: { fontFamily: F.regular, fontSize: T.body, lineHeight: 22, color: C.ink2, marginTop: 10 },
  findBtn: { alignSelf: "flex-start", height: 44, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, justifyContent: "center", marginTop: 16 },
  findText: { fontFamily: F.semibold, fontSize: T.body, color: "#fff" },
  hint: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: 8 },
  empty: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 18, borderWidth: 1, borderColor: C.hairline },
  meta: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3 },
  name: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink, marginTop: 4 },
  fit: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink2, marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  tags: { flexDirection: "row", gap: 6, flexShrink: 1 },
  cap: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.fill },
  capText: { fontFamily: F.medium, fontSize: T.meta, color: C.ink2 },
  night: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.yellow },
  nightText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  contact: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  contactText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
});
