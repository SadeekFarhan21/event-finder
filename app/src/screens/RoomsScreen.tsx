// "Rooms": the partner-team view. Yelo's playbook is to take a venue's quiet night,
// build an event there and fill it with riders, so this lists rooms worth pitching.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "../components/Tap";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { roomInterest, runLeads } from "../data/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pitchEmail } from "../lib/pitch";
import type { Lead } from "../lib/types";
import { color as C, font as F, radius as R, text as T } from "../theme";

// Same rule as the agent: a type only when it's already short ("Wine bar"), never a cut-off description.
function shortKind(kind?: string | null) {
  const k = (kind ?? "").split("(")[0].split(/\s+with\s+/i)[0].trim();
  if (!k || k.split(/\s+/).length > 3 || k.length > 22 || /[\/–—]/.test(k)) return "";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

// Yelo's brief is rooms for 50-400 people; hide known capacities outside it (same rule as the agent).
function inBrief(capacity?: string | null) {
  const n = Number((capacity ?? "").match(/\d+/)?.[0]);
  return !n || (n >= 50 && n <= 400);
}

// "@nublu" is Instagram, "booking@nublu.net" is email, a URL (or no contact) is the website.
type Reach = "email" | "instagram" | "web";
function reach(l: Lead): Reach {
  const c = l.contact ?? "";
  if (c.startsWith("@")) return "instagram";
  if (c.includes("@")) return "email";
  return "web";
}
const REACH: Record<Reach, { icon: "mail" | "instagram" | "arrow-up-right"; label: (venue: string) => string }> = {
  email: { icon: "mail", label: (v) => `Email ${v}` },
  instagram: { icon: "instagram", label: (v) => `Open ${v} on Instagram` },
  web: { icon: "arrow-up-right", label: (v) => `Open the website of ${v}` },
};

const CONTACTED_KEY = "scout.roomsContacted";
// "today", "yesterday", or "Nov 4".
function contactedWhen(t: number) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RoomsScreen({ visible, city, leads, setLeads, canSearch, onClose }: {
  visible: boolean; city: string; leads: Lead[]; setLeads: (l: Lead[]) => void; canSearch: boolean; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false); // the agent was still searching when we stopped waiting
  // Warm leads: rooms Scout riders already open. Shown on the row and sorted first.
  const [interest, setInterest] = useState<Record<string, number>>({});
  useEffect(() => { if (visible) roomInterest(city).then(setInterest); }, [visible, city]);

  const find = async () => {
    setBusy(true);
    setError(null);
    setPending(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const run = await runLeads(city);
      setLeads(run.leads);
      setPending(run.pending);
      if (!run.pending) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Rooms the team already reached out to (kept on this phone): marked and moved below the rest.
  const [contacted, setContacted] = useState<Record<string, number>>({});
  useEffect(() => { AsyncStorage.getItem(CONTACTED_KEY).then((r) => r && setContacted(JSON.parse(r))).catch(() => {}); }, []);
  const markContacted = useCallback((id: string) => {
    setContacted((cur) => ({ ...cur, [id]: Date.now() })); // tap time
  }, []);
  // Persist after the state settles (side effects stay out of the updater).
  useEffect(() => { if (Object.keys(contacted).length) AsyncStorage.setItem(CONTACTED_KEY, JSON.stringify(contacted)).catch(() => {}); }, [contacted]);

  const contact = (l: Lead) => {
    markContacted(l.id);
    const c = l.contact ?? "";
    if (reach(l) === "email") {
      const { subject, body } = pitchEmail(l, city, interest[l.venue] ?? 0);
      return Linking.openURL(`mailto:${c}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    }
    if (reach(l) === "instagram") return Linking.openURL(`https://instagram.com/${c.slice(1)}`);
    if (/^https?:\/\//.test(c)) return Linking.openURL(c);
    if (l.url) return Linking.openURL(l.url);
  };

  const insets = useSafeAreaInsets();
  // The header scrolls with the list: on a small phone a fixed header left room for ~1.5 cards.
  const header = (
    <View style={s.head}>
      <View style={s.topRow}>
        <Tap onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close rooms">
          <Feather name="chevron-down" size={20} color={C.ink} />
        </Tap>
      </View>
      <Text style={s.title}>Rooms worth{"\n"}<Text style={s.titleAccent}>pitching.</Text></Text>
      <Text style={s.sub}>
        Independent rooms in {city.split(",")[0]} that could host a Yelo night, for the partner team.
      </Text>
      <Tap onPress={find} disabled={busy || !canSearch} style={[s.findBtn, !canSearch && s.findBtnOff]}
        accessibilityState={{ busy, disabled: busy || !canSearch }}>
        {busy ? <ActivityIndicator color={C.surface} size="small" /> : <Text style={[s.findText, !canSearch && { color: C.ink3 }]}>{leads.length ? "Find more rooms" : "Find rooms"}</Text>}
      </Tap>
      {busy && <Text style={s.hint} accessibilityLiveRegion="polite">Searching venue sites and calendars. This takes about a minute.</Text>}
      {!busy && !canSearch && <Text style={s.hint}>Searching isn't available right now. The rooms below are from the last search.</Text>}
      {pending && !busy && <Text style={s.hint} accessibilityLiveRegion="polite">Still searching. New rooms will be here when you open Rooms again.</Text>}
      {error && <Text style={[s.hint, { color: C.red }]} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, Platform.OS === "android" && { paddingTop: insets.top }]}>
        <FlatList data={leads.filter((l) => inBrief(l.capacity)).sort((a, b) => Number(!!contacted[a.id]) - Number(!!contacted[b.id]) || (interest[b.venue] ?? 0) - (interest[a.venue] ?? 0))} keyExtractor={(l) => l.id} ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 32 }}
          ListEmptyComponent={busy ? undefined : <Text style={s.empty}>{canSearch ? "No rooms yet. Tap Find rooms to search this city." : "No rooms saved for this city yet."}</Text>}
          ItemSeparatorComponent={() => <View style={s.rule} />}
          renderItem={({ item: l }) => (
            <View style={s.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, !!contacted[l.id] && s.nameDone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{l.venue}</Text>
                <Text style={s.meta} numberOfLines={1}>{[l.area?.replace(/\s*\([^)]*(\)|$)/g, ""), shortKind(l.kind)].filter(Boolean).join("  ·  ")}</Text>
                <Text style={s.fit} numberOfLines={2}>{l.fit}</Text>
                {(contacted[l.id] || interest[l.venue] || l.quietNight || l.capacity) ? (
                  <View style={s.notes}>
                    {contacted[l.id] ? (
                      <Text style={s.contacted} numberOfLines={1}>Contacted {contactedWhen(contacted[l.id])}</Text>
                    ) : null}
                    {interest[l.venue] ? (
                      <Text style={s.warm} numberOfLines={1}>Riders opened it {interest[l.venue] === 1 ? "once" : `${interest[l.venue]} times`} this week</Text>
                    ) : null}
                    {(l.quietNight || l.capacity) && (
                      <Text style={s.facts} numberOfLines={1}>
                        {[l.quietNight && `Quiet ${l.quietNight}s`, l.capacity].filter(Boolean).join("  ·  ")}
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
              {(l.contact || l.url) && (
                <Tap onPress={() => contact(l)} style={s.go} hitSlop={8}
                  accessibilityLabel={REACH[reach(l)].label(l.venue)}>
                  <Feather name={REACH[reach(l)].icon} size={17} color={C.ink} />
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
  // Same header as Crews: round close, display title, one line of context, then the action.
  head: { paddingTop: 12, paddingBottom: 8 },
  topRow: { flexDirection: "row", marginBottom: 16 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 44, color: C.ink, marginTop: 4 },
  titleAccent: { fontFamily: F.displayItalic },
  sub: { fontFamily: F.regular, fontSize: T.small, lineHeight: 21, color: C.ink2, marginTop: 8 },
  findBtn: { alignSelf: "flex-start", height: 44, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, justifyContent: "center", marginTop: 20 },
  findBtnOff: { backgroundColor: C.fill },
  findText: { fontFamily: F.semibold, fontSize: T.body, color: C.surface },
  hint: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink3, marginTop: 8 },
  empty: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, marginTop: 32 },
  meta: { fontFamily: F.medium, fontSize: T.small, color: C.ink2, marginTop: 2 },
  name: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  fit: { fontFamily: F.regular, fontSize: T.small, lineHeight: 20, color: C.ink3, marginTop: 8 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairline },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 20 },
  notes: { marginTop: 12, gap: 4 }, // contacted, warm and facts lines sit together as one group
  nameDone: { color: C.ink2 }, // already contacted: still there, but the open leads read first
  contacted: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3 },
  warm: { fontFamily: F.medium, fontSize: T.meta, color: C.ink },
  facts: { fontFamily: F.medium, fontSize: T.meta, color: C.ink2 },
  go: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, marginTop: 4 },
});
