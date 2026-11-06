// "Rooms": the partner-team view. Yelo's playbook is to take a venue's quiet night,
// build an event there and fill it with riders, so this lists rooms worth pitching.
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getLeads, runLeads, type Lead } from "./api";
import { color as C, font as F, radius as R, shadow } from "./theme";

export function useLeads(city: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    getLeads(city).then((r) => setLeads(r.leads)).catch(() => setLeads([]));
  }, [city]);
  return [leads, setLeads] as const;
}

export function Rooms({ visible, city, leads, setLeads, canSearch, onClose }: {
  visible: boolean; city: string; leads: Lead[]; setLeads: (l: Lead[]) => void; canSearch: boolean; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const r = await runLeads(city);
      setLeads(r.leads);
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={12} style={s.close}>
            <Ionicons name="chevron-down" size={22} color={C.ink} />
          </Pressable>
          <Text style={s.eyebrow}>For Yelo's partner team · {city.split(",")[0]}</Text>
          <Text style={s.title}>Rooms worth{"\n"}<Text style={s.titleAccent}>pitching.</Text></Text>
          <Text style={s.sub}>
            Independent venues that could host a Yelo night: the vibe, the size, and a night that likely runs quiet.
          </Text>
          <Pressable onPress={find} disabled={busy || !canSearch}
            style={({ pressed }) => [s.findBtn, (!canSearch) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.findText}>{leads.length ? "Find more rooms" : "Find rooms"}</Text>}
          </Pressable>
          {busy && <Text style={s.hint}>Searching venue sites and calendars · about a minute</Text>}
          {error && <Text style={[s.hint, { color: "#C0392B" }]}>{error}</Text>}
        </View>

        <FlatList data={leads} keyExtractor={(l) => l.id} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}
          ListEmptyComponent={busy ? undefined : <Text style={s.empty}>No rooms yet for this city.</Text>}
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
                  <Pressable onPress={() => contact(l)} style={({ pressed }) => [s.contact, pressed && { opacity: 0.7 }]}>
                    <Text style={s.contactText}>{l.contact?.includes("@") ? "Contact" : "Website"}</Text>
                    <Ionicons name="arrow-forward" size={14} color={C.ink} />
                  </Pressable>
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
  head: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  close: { alignSelf: "flex-start", width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 14, ...shadow },
  eyebrow: { fontFamily: F.medium, fontSize: 12, color: C.ink3 },
  title: { fontFamily: F.display, fontSize: 44, lineHeight: 46, color: C.ink, marginTop: 6 },
  titleAccent: { fontFamily: "InstrumentSerif_400Regular_Italic", color: C.blue },
  sub: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.ink2, marginTop: 10 },
  findBtn: { alignSelf: "flex-start", height: 44, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, justifyContent: "center", marginTop: 16 },
  findText: { fontFamily: F.semibold, fontSize: 15, color: "#fff" },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.ink3, marginTop: 8 },
  empty: { fontFamily: F.regular, fontSize: 15, color: C.ink3, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 18, ...shadow },
  meta: { fontFamily: F.medium, fontSize: 12, color: C.ink3 },
  name: { fontFamily: F.display, fontSize: 28, lineHeight: 32, color: C.ink, marginTop: 4 },
  fit: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.ink2, marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  tags: { flexDirection: "row", gap: 6, flexShrink: 1 },
  cap: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.fill },
  capText: { fontFamily: F.medium, fontSize: 12, color: C.ink2 },
  night: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.yellow },
  nightText: { fontFamily: F.semibold, fontSize: 12, color: C.ink },
  contact: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  contactText: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
});
