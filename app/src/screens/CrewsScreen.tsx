// "Crews": the friends side of Scout. Every crew you're in tonight (who's coming, who's on the
// way), joining a friend's crew from the link they sent, and a nudge to start one.
// Real data only: crews, members and spot photos from Scout; no invented tables, chats or perks.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { crewInvite, leaveLabel, savedName, type Crew, type CrewStatus } from "../data/crews";
import { Tap } from "../components/Tap";
import { initials } from "../lib/friends";
import { color as C, font as F, radius as R, text as T } from "../theme";


export function CrewsScreen({ visible, crews, photos, linkCode, onJoin, onStatus, onRide, onOpen, onClose }: {
  visible: boolean; crews: Crew[];
  photos: Record<string, string | null | undefined>; // spot id -> photo, for the crew cards
  linkCode?: string | null; // a crew code from a scout://crew/<code> link, ready to join
  onJoin: (code: string, name: string) => Promise<string>;
  onStatus: (code: string, s: CrewStatus) => Promise<boolean>;
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
  // A crew link fills the join form, unless it's a crew you're already in. On a cold start your crews
  // load after the link arrives, so clear the code again once it turns out to be one of yours.
  useEffect(() => {
    if (!linkCode) return;
    const mine = crews.some((c) => c.code === linkCode);
    setCode((cur) => (mine ? (cur === linkCode ? "" : cur) : cur || linkCode));
  }, [linkCode, crews]);

  // The join form sits at the end of the list. With crews above it, the keyboard used to cover the field
  // and the Join button; once the keyboard is up, bring the form into view.
  const list = useRef<FlatList<Crew>>(null);
  const joining = useRef(false); // a join field has focus
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => { if (joining.current) list.current?.scrollToEnd({ animated: true }); });
    return () => sub.remove();
  }, []);
  const joinFocus = { onFocus: () => { joining.current = true; }, onBlur: () => { joining.current = false; } };

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
      {/* How crews work, until you're in one; after that the crews themselves show it. */}
      {crews.length === 0 && <Text style={s.sub}>Friends join from your link, and everyone sees who's coming and who's on the way.</Text>}

      {/* No crews yet: no empty heading; the start card below leads. */}
      {crews.length > 0 && <View style={s.sectionRow}>
        <Text style={s.section} numberOfLines={1}>Active tonight</Text>
        {live.length > 0 && <View style={s.countPill}><Text style={s.countText}>{live.length}</Text></View>}
      </View>}
    </View>
  );

  // Your crews come first; starting or joining one is the rarer case, below them.
  const footer = (
    <View style={{ gap: 12 }}>
      <Tap pressedScale={0.99} onPress={onClose} style={s.start} accessibilityLabel="Start a crew: pick a spot on the map">
        <View style={{ flex: 1 }}>
          <Text style={s.startTitle}>Start one from any spot</Text>
          <Text style={s.startSub}>Pick a spot on the map, tap Go with friends, and send the link.</Text>
        </View>
        <View style={s.startBtn}><Feather name="plus" size={22} color={C.ink} /></View>
      </Tap>
      {/* Join a friend's crew from a pasted link */}
      <View style={s.joinBox}>
        <Text style={s.joinTitle}>Got a link from a friend?</Text>
        <Field label="Crew link or code">
          <TextInput selectionColor={C.selection} cursorColor={C.accent} value={code} onChangeText={(v) => { setCode(v); setJoined(null); }}
            placeholder="Paste the link they sent" placeholderTextColor={C.placeholder} style={s.input}
            autoCapitalize="none" autoCorrect={false} accessibilityLabel="Crew link or code" {...joinFocus} />
        </Field>
        <Field label="Your first name">
          <TextInput selectionColor={C.selection} cursorColor={C.accent} value={name} onChangeText={setName} placeholder="First name"
            placeholderTextColor={C.placeholder} style={s.input} maxLength={30} autoCapitalize="words" accessibilityLabel="Your first name" {...joinFocus} />
        </Field>
        {error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
        {joined !== null && !error && <Text style={s.success} accessibilityLiveRegion="polite">{joined ? `You're in. The crew for ${joined} is at the top.` : "You're in. Your crew is at the top."}</Text>}
        <Tap style={[s.joinBtn, !ready && s.joinBtnOff]} disabled={!ready || busy} onPress={join}>
            {busy ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={[s.joinText, !ready && { color: C.ink3 }]}>Join crew</Text>}
        </Tap>
      </View>

    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[s.root, Platform.OS === "android" && { paddingTop: insets.top }]}>
        <FlatList ref={list} data={crews} keyExtractor={(c) => c.code} ListHeaderComponent={header} ListFooterComponent={footer}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CrewTile crew={item} photo={photos[item.spotId]} onStatus={onStatus} onRide={onRide} onOpen={onOpen} />
          )} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  onStatus: (code: string, s: CrewStatus) => Promise<boolean>; onRide: (c: Crew) => void; onOpen: (c: Crew) => void;
}) {
  const me = crew.members.find((m) => m.me);
  const coming = crew.members.filter((m) => m.status !== "out");
  const onWay = crew.members.filter((m) => m.status === "on_way").length;
  const out = me?.status === "out";
  const [failed, setFailed] = useState(false);
  const set = async (st: CrewStatus) => setFailed(!(await onStatus(crew.code, st)));
  return (
    <View style={s.tile}>
      <Tap pressedScale={0.99} onPress={() => onOpen(crew)} accessibilityLabel={`Open ${crew.venue}`}>
        {/* No photo (common for scraped spots): no empty block, just the leave time above the name. */}
        {photo ? (
          <View style={s.strip}>
            <Image source={photo} style={[StyleSheet.absoluteFill, out && s.photoOut]} contentFit="cover" transition={200} />
            <LinearGradient pointerEvents="none" colors={["rgba(21,21,19,0)", C.surface]} style={StyleSheet.absoluteFill} />
            <View style={s.stripChip}><View style={s.dot} /><Text style={s.stripChipText}>{leaveLabel(crew.leaveAt)}</Text></View>
          </View>
        ) : (
          <View style={[s.stripChip, s.chipInline]}><View style={s.dot} /><Text style={s.stripChipText}>{leaveLabel(crew.leaveAt)}</Text></View>
        )}
        <Text style={[s.venue, out && s.venueOut]} numberOfLines={1}>{crew.venue}</Text>
        <View style={s.addrRow}>
          <Feather name="map-pin" size={13} color={C.ink3} />
          <Text style={s.addr} numberOfLines={1}>{crew.address.split(",")[0]}  ·  {crew.title}</Text>
        </View>
      </Tap>

      <View style={s.people}>
        <View style={s.faces}>
          {coming.slice(0, 4).map((m, i) => (
            <View key={i} style={[s.face, { marginLeft: i ? -8 : 0, zIndex: 4 - i }, m.status === "on_way" && s.faceOnWay]}>
              <Text style={[s.faceText, m.status === "on_way" && { color: C.bg }]}>{m.me ? "You" : initials(m.name)}</Text>
            </View>
          ))}
          {coming.length > 4 && <View style={[s.face, { marginLeft: -8 }]}><Text style={s.faceText}>+{coming.length - 4}</Text></View>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.peopleTitle}>{coming.length} coming</Text>
          <Text style={s.peopleSub}>{onWay && onWay === coming.length ? "Everyone's on the way" : onWay ? `${onWay} on the way` : "No one's on the way yet"}</Text>
        </View>
        <Tap style={s.round} hitSlop={6} accessibilityLabel="Invite to crew" onPress={() => Share.share({ message: crewInvite(crew) }).catch(() => {})}>
          <Feather name="user-plus" size={16} color={C.ink} />
        </Tap>
      </View>

      <View style={s.actions}>
        <Tap style={[s.btn, s.btnQuiet]} onPress={() => set(out ? "in" : "out")}>
          <Text style={s.btnQuietText}>{out ? "I'm back in" : "Can't make it"}</Text>
        </Tap>
        <Tap style={[s.btn, s.btnPrimary]} onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (me?.status !== "on_way") set("on_way");
          onRide(crew);
        }}>
          <Text style={s.btnPrimaryText}>{me?.status === "on_way" ? "Ride there" : "I'm on my way"}</Text>
        </Tap>
      </View>
      {failed && <Text style={s.statusErr} accessibilityLiveRegion="polite">{"Your crew didn't get that. Check your connection and try again."}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingTop: 12, paddingBottom: 4 },
  topRow: { flexDirection: "row", marginBottom: 16 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 46, color: C.ink, marginTop: 4 },
  titleItalic: { fontFamily: F.displayItalic },
  sub: { fontFamily: F.regular, fontSize: T.small, lineHeight: 21, color: C.ink2, marginTop: 8 },
  joinBox: { padding: 16, borderRadius: R.lg, backgroundColor: C.surface, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  joinTitle: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  fieldLabel: { fontFamily: F.medium, fontSize: T.small, color: C.ink2 },
  fieldBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.bg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  input: { flex: 1, fontFamily: F.regular, fontSize: T.body, color: C.ink, paddingVertical: 0 },
  success: { fontFamily: F.medium, fontSize: T.small, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red },
  joinBtn: { height: 48, borderRadius: R.pill, backgroundColor: C.ink, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 4 },
  joinBtnOff: { backgroundColor: C.fill },
  joinText: { fontFamily: F.semibold, fontSize: T.body, color: C.bg },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 },
  section: { flexShrink: 1, fontFamily: F.display, fontSize: T.title, color: C.ink },
  countPill: { minWidth: 24, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.d3 },
  countText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  tile: { padding: 12, borderRadius: R.lg, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4, gap: 12 },
  strip: { height: 112, borderRadius: R.md, overflow: "hidden", backgroundColor: C.d2 },
  stripChip: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: R.pill,
    backgroundColor: "rgba(12,12,10,0.75)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  chipInline: { position: "relative", top: 0, left: 0, alignSelf: "flex-start", marginTop: 4, marginLeft: 4, backgroundColor: C.d2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink },
  stripChipText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  venue: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink, marginTop: 8, paddingHorizontal: 4 },
  // A crew you said you can't make: the name and photo step back, text stays above the contrast
  // floor (fading the whole tile took the address under 4.5:1).
  venueOut: { color: C.ink2 },
  photoOut: { opacity: 0.5 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  addr: { flex: 1, fontFamily: F.regular, fontSize: T.small, color: C.ink3 },
  people: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  faces: { flexDirection: "row" },
  face: { minWidth: 32, height: 32, paddingHorizontal: 2, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.d3, borderWidth: 2, borderColor: C.surface },
  faceOnWay: { backgroundColor: C.ink },
  faceText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  peopleTitle: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  peopleSub: { fontFamily: F.regular, fontSize: T.meta, color: C.ink3, marginTop: 2 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  statusErr: { fontFamily: F.medium, fontSize: T.small, color: C.red, paddingHorizontal: 4 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { height: 46, borderRadius: R.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  btnPrimary: { flex: 1.3, backgroundColor: C.accent },
  btnPrimaryText: { fontFamily: F.semibold, fontSize: T.small, color: C.onAccent },
  btnQuiet: { flex: 1, backgroundColor: C.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  btnQuietText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink2 },
  start: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, marginTop: 20, borderRadius: R.lg, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  startTitle: { fontFamily: F.semibold, fontSize: T.body, color: C.ink },
  startSub: { fontFamily: F.regular, fontSize: T.meta, lineHeight: 17, color: C.ink3, marginTop: 2 },
  startBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: C.d3 },
});
