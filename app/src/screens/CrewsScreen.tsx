// "Crews": the friends side of Scout. Every crew you're in tonight (who's coming, who's on the
// way), joining a friend's crew from the link they sent, and a nudge to start one.
// Real data only: crews, members and spot photos from Scout; no invented tables, chats or perks.
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { crewInvite, leaveLabel, savedName, type Crew, type CrewStatus } from "../data/crews";
import { Tap } from "../components/Tap";
import { color as C, font as F, radius as R, text as T } from "../theme";

const ACCENT_TINT = C.d3;

export function CrewsScreen({ visible, crews, photos, linkCode, onJoin, onStatus, onRide, onOpen, onClose }: {
  visible: boolean; crews: Crew[];
  photos: Record<string, string | null | undefined>; // spot id -> photo, for the crew cards
  linkCode?: string | null; // a crew code from a scout://crew/<code> link, ready to join
  onJoin: (code: string, name: string) => Promise<string>;
  onStatus: (code: string, s: CrewStatus) => void;
  onRide: (crew: Crew) => void;
  onOpen: (crew: Crew) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null); // venue of the crew just joined
  useEffect(() => { if (visible) savedName().then((n) => n && setName((cur) => cur || n)); }, [visible]);
  useEffect(() => { if (linkCode && !crews.some((c) => c.code === linkCode)) setCode(linkCode); }, [linkCode, crews]);

  const live = crews.filter((c) => c.members.some((m) => m.me && m.status !== "out"));
  const ready = !!code.trim() && !!name.trim();

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await onJoin(code, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(crews.find((x) => x.code === c)?.venue ?? "");
      setCode("");
    } catch (e) {
      setError((e as Error).message || "Couldn't join that crew");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={s.head}>
      <View style={s.topRow}>
        <Tap onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close crews">
          <Feather name="chevron-down" size={20} color={C.ink} />
        </Tap>
      </View>
      <Text style={s.title}>Your <Text style={s.titleItalic}>crews.</Text></Text>
      {live.length > 0 && (
        <View style={s.eyebrowRow}><View style={s.liveDot} /><Text style={s.eyebrow}>{live.length} heading out tonight</Text></View>
      )}
      <Text style={s.sub}>Start one from any spot with Heading out. Friends join from your link, and everyone sees who's coming and who's on the way.</Text>

      {/* Join a friend's crew */}
      <View style={s.joinBox}>
        <View style={s.joinHead}>
          <Text style={s.joinTitle}>Got a link from a friend?</Text>
        </View>
        <Field label="Crew link or code">
          <TextInput selectionColor={C.selection} cursorColor={C.accent} value={code} onChangeText={(v) => { setCode(v); setJoined(null); }}
            placeholder="Paste the link they sent" placeholderTextColor={C.placeholder} style={s.input}
            autoCapitalize="none" autoCorrect={false} accessibilityLabel="Crew link or code" />
        </Field>
        <Field label="Your first name">
          <TextInput selectionColor={C.selection} cursorColor={C.accent} value={name} onChangeText={setName} placeholder="First name"
            placeholderTextColor={C.placeholder} style={s.input} maxLength={30} autoCapitalize="words" accessibilityLabel="Your first name" />
        </Field>
        {error && <Text style={s.error}>{error}</Text>}
        {joined !== null && !error && <Text style={s.success}>{joined ? `You're in. The crew for ${joined} is below.` : "You're in. Your crew is below."}</Text>}
        <Tap style={[s.joinBtn, !ready && s.joinBtnOff]} disabled={!ready || busy} onPress={join}>
          {busy ? <ActivityIndicator color={C.onAccent} size="small" /> : (
            <>
              <Text style={[s.joinText, !ready && { color: C.ink3 }]}>Join crew</Text>
            </>
          )}
        </Tap>
      </View>

      <View style={s.sectionRow}>
        <Text style={s.section} numberOfLines={1}>Active tonight</Text>
        {live.length > 0 && <View style={s.countPill}><Text style={s.countText}>{live.length}</Text></View>}
      </View>
    </View>
  );

  const footer = (
    <Tap pressedScale={0.99} onPress={onClose} style={s.start} accessibilityLabel="Start a crew: pick a spot on the map">
      <View style={{ flex: 1 }}>
        <Text style={s.startTitle}>Start one from any spot</Text>
        <Text style={s.startSub}>Pick a spot on the map, tap Heading out, and send the link.</Text>
      </View>
      <View style={s.startBtn}><Feather name="plus" size={24} color={C.ink} /></View>
    </Tap>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, Platform.OS === "android" && { paddingTop: insets.top }]}>
        <FlatList data={crews} keyExtractor={(c) => c.code} ListHeaderComponent={header} ListFooterComponent={footer}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={s.empty}>No crews yet tonight.</Text>}
          renderItem={({ item }) => (
            <CrewTile crew={item} photo={photos[item.spotId]} onStatus={onStatus} onRide={onRide} onOpen={onOpen} />
          )} />
      </View>
    </Modal>
  );
}

function Field({ label, children }: { icon?: string; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldBox}>
        {children}
      </View>
    </View>
  );
}

// One crew: the spot's photo, when you're leaving, who's in, and the one action that matters.
function CrewTile({ crew, photo, onStatus, onRide, onOpen }: {
  crew: Crew; photo?: string | null;
  onStatus: (code: string, s: CrewStatus) => void; onRide: (c: Crew) => void; onOpen: (c: Crew) => void;
}) {
  const me = crew.members.find((m) => m.me);
  const coming = crew.members.filter((m) => m.status !== "out");
  const onWay = crew.members.filter((m) => m.status === "on_way").length;
  const out = me?.status === "out";
  return (
    <View style={[s.tile, out && { opacity: 0.6 }]}>
      <Tap pressedScale={0.99} onPress={() => onOpen(crew)} accessibilityLabel={`Open ${crew.venue}`}>
        <View style={s.strip}>
          {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            : null}
          <LinearGradient pointerEvents="none" colors={["rgba(21,21,19,0)", C.surface]} style={StyleSheet.absoluteFill} />
          <View style={s.stripChip}><View style={s.dot} /><Text style={s.stripChipText}>{leaveLabel(crew.leaveAt)}</Text></View>
        </View>
        <Text style={s.venue} numberOfLines={1}>{crew.venue}</Text>
        <View style={s.addrRow}>
          <Feather name="map-pin" size={13} color={C.ink3} />
          <Text style={s.addr} numberOfLines={1}>{crew.address.split(",")[0]}  ·  {crew.title}</Text>
        </View>
      </Tap>

      <View style={s.people}>
        <View style={s.faces}>
          {coming.slice(0, 4).map((m, i) => (
            <View key={i} style={[s.face, { marginLeft: i ? -8 : 0, zIndex: 4 - i }, m.status === "on_way" && s.faceOnWay]}>
              <Text style={[s.faceText, m.status === "on_way" && { color: C.bg }]}>{m.me ? "You" : m.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          ))}
          {coming.length > 4 && <View style={[s.face, { marginLeft: -8 }]}><Text style={s.faceText}>+{coming.length - 4}</Text></View>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.peopleTitle}>{coming.length} coming</Text>
          <Text style={s.peopleSub}>{onWay ? `${onWay} on the way` : "Nobody's left yet"}</Text>
        </View>
        <Tap style={s.round} accessibilityLabel="Invite to crew" onPress={() => Share.share({ message: crewInvite(crew) }).catch(() => {})}>
          <Feather name="user-plus" size={16} color={C.ink} />
        </Tap>
      </View>

      <View style={s.actions}>
        <Tap style={[s.btn, s.btnQuiet]} onPress={() => onStatus(crew.code, out ? "in" : "out")}>
          <Text style={s.btnQuietText}>{out ? "I'm back in" : "Can't make it"}</Text>
        </Tap>
        <Tap style={[s.btn, s.btnPrimary]} onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (me?.status !== "on_way") onStatus(crew.code, "on_way");
          onRide(crew);
        }}>
          <Text style={s.btnPrimaryText}>{me?.status === "on_way" ? "Open ride" : "I'm on my way"}</Text>
        </Tap>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingTop: 12, paddingBottom: 4 },
  topRow: { flexDirection: "row", marginBottom: 16 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink },
  eyebrow: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 46, color: C.ink, marginTop: 4 },
  titleItalic: { fontFamily: F.displayItalic },
  sub: { fontFamily: F.regular, fontSize: T.small, lineHeight: 21, color: C.ink2, marginTop: 8 },
  joinBox: { marginTop: 20, padding: 16, borderRadius: R.lg, backgroundColor: C.surface, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  joinHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconTile: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: ACCENT_TINT },
  joinTitle: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  fieldLabel: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink3, letterSpacing: 1, textTransform: "uppercase" },
  fieldBox: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.bg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  input: { flex: 1, fontFamily: F.regular, fontSize: T.body, color: C.ink, paddingVertical: 0 },
  success: { fontFamily: F.medium, fontSize: T.small, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red },
  joinBtn: { height: 50, borderRadius: R.pill, backgroundColor: C.accent, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 4 },
  joinBtnOff: { backgroundColor: C.fill },
  joinText: { fontFamily: F.semibold, fontSize: T.body, color: C.onAccent },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28 },
  section: { flexShrink: 1, fontFamily: F.display, fontSize: T.title, color: C.ink },
  countPill: { minWidth: 24, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.d3 },
  countText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  empty: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, marginTop: 4 },
  tile: { padding: 12, borderRadius: R.lg, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, gap: 12 },
  strip: { height: 112, borderRadius: R.md, overflow: "hidden", backgroundColor: C.d2 },
  stripEmpty: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "flex-end", justifyContent: "center", paddingRight: 20 },
  stripChip: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: R.pill,
    backgroundColor: "rgba(12,12,10,0.75)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink },
  stripChipText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  venue: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink, marginTop: 8, paddingHorizontal: 4 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  addr: { flex: 1, fontFamily: F.regular, fontSize: T.small, color: C.ink3 },
  people: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  faces: { flexDirection: "row" },
  face: { minWidth: 32, height: 32, paddingHorizontal: 2, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.d3, borderWidth: 2, borderColor: C.surface },
  faceOnWay: { backgroundColor: C.ink },
  faceText: { fontFamily: F.semibold, fontSize: 10, color: C.ink },
  peopleTitle: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  peopleSub: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 1 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.fill },
  actions: { flexDirection: "row", gap: 8 },
  btn: { height: 46, borderRadius: R.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  btnPrimary: { flex: 1.3, backgroundColor: C.accent },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: T.small, color: C.onAccent },
  btnQuiet: { flex: 1, backgroundColor: C.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  btnQuietText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink2 },
  start: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, marginTop: 8, borderRadius: R.lg, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  startTitle: { fontFamily: F.semibold, fontSize: T.body, color: C.ink },
  startSub: { fontFamily: F.regular, fontSize: T.meta, lineHeight: 17, color: C.ink3, marginTop: 2 },
  startBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: C.d3 },
});
