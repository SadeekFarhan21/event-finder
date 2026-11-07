// "Rooms": the partner-team view. Yelo's playbook is to take a venue's quiet night,
// build an event there and fill it with riders, so this lists rooms worth pitching.
import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "../components/Tap";
import { Feather } from "@expo/vector-icons";
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
    <View style={s.head}>
      <Tap onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close rooms">
        <Feather name="chevron-down" size={22} color={C.ink} />
      </Tap>
      <Text style={s.title}>Rooms worth{"\n"}<Text style={s.titleAccent}>pitching.</Text></Text>
      <Text style={s.sub}>
        Independent rooms in {city.split(",")[0]} that could host a Yelo night, for the partner team.
      </Text>
      <Tap onPress={find} disabled={busy || !canSearch} style={[s.findBtn, !canSearch && { opacity: 0.4 }]}
        accessibilityState={{ busy, disabled: busy || !canSearch }}>
        {busy ? <ActivityIndicator color={C.surface} size="small" /> : <Text style={s.findText}>{leads.length ? "Find more rooms" : "Find rooms"}</Text>}
      </Tap>
      {busy && <Text style={s.hint}>Searching venue sites and calendars · about a minute</Text>}
      {error && <Text style={[s.hint, { color: C.red }]}>{error}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, Platform.OS === "android" && { paddingTop: insets.top }]}>
        <FlatList data={leads} keyExtractor={(l) => l.id} ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 32 }}
          ListEmptyComponent={busy ? undefined : <Text style={s.empty}>No rooms yet. Tap Find rooms to search this city.</Text>}
          ItemSeparatorComponent={() => <View style={s.rule} />}
          renderItem={({ item: l }) => (
            <View style={s.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{l.venue}</Text>
                <Text style={s.meta} numberOfLines={1}>{[l.area?.replace(/\s*\([^)]*\)/g, ""), l.kind && l.kind.charAt(0).toUpperCase() + l.kind.slice(1)].filter(Boolean).join("  ·  ")}</Text>
                <Text style={s.fit} numberOfLines={2}>{l.fit}</Text>
                {(l.quietNight || l.capacity) && (
                  <Text style={s.facts} numberOfLines={1}>
                    {[l.quietNight && `Quiet ${l.quietNight}s`, l.capacity].filter(Boolean).join("   ·   ")}
                  </Text>
                )}
              </View>
              {(l.contact || l.url) && (
                <Tap onPress={() => contact(l)} style={s.go} hitSlop={8}
                  accessibilityLabel={`${l.contact?.includes("@") ? "Email" : "Open the website of"} ${l.venue}`}>
                  <Feather name={l.contact?.includes("@") ? "mail" : "arrow-up-right"} size={17} color={C.ink} />
                </Tap>
              )}
            </View>
          )} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingTop: 16, paddingBottom: 8 },
  close: { alignSelf: "flex-start", width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: C.hairline },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 44, color: C.ink, marginTop: 8 },
  titleAccent: { fontFamily: F.displayItalic },
  sub: { fontFamily: F.regular, fontSize: T.body, lineHeight: 22, color: C.ink2, marginTop: 12 },
  findBtn: { alignSelf: "flex-start", height: 44, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, justifyContent: "center", marginTop: 16 },
  findText: { fontFamily: F.semibold, fontSize: T.body, color: C.surface },
  hint: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: 8 },
  empty: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, marginTop: 40 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.hairline },
  meta: { fontFamily: F.medium, fontSize: T.small, color: C.ink2, marginTop: 2 },
  name: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  fit: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink3, marginTop: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  tags: { flexDirection: "row", gap: 8, flexShrink: 1 },
  cap: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.fill },
  capText: { fontFamily: F.medium, fontSize: T.meta, color: C.ink2 },
  night: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.fill },
  nightText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  contact: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingLeft: 12 },
  contactText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairline },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 20 },
  facts: { fontFamily: F.medium, fontSize: T.meta, color: C.ink2, marginTop: 10 },
  go: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, marginTop: 2 },
});
