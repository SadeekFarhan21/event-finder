// "Crews": the friends side of Scout. Every crew you're in, who's coming and who's on the way,
// plus joining a friend's crew from the code or link they sent.
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { savedName, type Crew, type CrewStatus } from "../data/crews";
import { CrewCard } from "../components/CrewCard";
import { Tap } from "../components/Tap";
import { color as C, font as F, radius as R, text as T } from "../theme";

export function CrewsScreen({ visible, crews, linkCode, onJoin, onStatus, onRide, onOpen, onClose }: {
  visible: boolean; crews: Crew[];
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

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await onJoin(code, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(crews.find((x) => x.code === c)?.venue ?? "the crew");
      setCode("");
    } catch (e) {
      setError((e as Error).message || "Couldn't join that crew");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={[s.head, Platform.OS === "android" && { paddingTop: insets.top + 16 }]}>
      <Tap onPress={onClose} hitSlop={12} style={s.close} accessibilityLabel="Close crews">
        <Ionicons name="chevron-down" size={22} color={C.ink} />
      </Tap>
      <Text style={s.title}>Your <Text style={s.titleAccent}>crews.</Text></Text>
      <Text style={s.sub}>Start one from any spot with Heading out. Friends join from your link, and everyone sees who's coming and who's on the way.</Text>

      <View style={s.joinBox}>
        <Text style={s.label}>Got a link from a friend?</Text>
        <Text style={s.fieldLabel}>Crew link or code</Text>
        <TextInput value={code} onChangeText={(v) => { setCode(v); setJoined(null); }} placeholder="scout-download.vercel.app/e.html?crew=…"
          placeholderTextColor={C.placeholder} style={s.input} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Crew link or code" />
        <Text style={s.fieldLabel}>Your first name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="First name" placeholderTextColor={C.placeholder}
          style={s.input} maxLength={30} autoCapitalize="words" accessibilityLabel="Your first name" />
        {error && <Text style={s.error}>{error}</Text>}
        {joined && !error && <Text style={s.success}>You're in. The crew for {joined} is below.</Text>}
        <Tap style={[s.joinBtn, (!code.trim() || !name.trim()) && { opacity: 0.4 }]} disabled={!code.trim() || !name.trim() || busy} onPress={join}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.joinText}>Join crew</Text>}
        </Tap>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <FlatList data={crews} keyExtractor={(c) => c.code} ListHeaderComponent={header}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>No crews yet tonight.</Text>}
          renderItem={({ item }) => (
            <CrewCard crew={item} showVenue onStatus={onStatus} onRide={onRide} onOpen={onOpen} />
          )} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8 },
  close: { alignSelf: "flex-start", width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: C.hairline },
  title: { fontFamily: F.display, fontSize: T.display, lineHeight: 44, color: C.ink },
  titleAccent: { fontFamily: "InstrumentSerif_400Regular_Italic", color: C.blue },
  sub: { fontFamily: F.regular, fontSize: T.body, lineHeight: 22, color: C.ink2, marginTop: 10 },
  joinBox: { marginTop: 18, padding: 16, borderRadius: R.lg, backgroundColor: C.surface, gap: 8, borderWidth: 1, borderColor: C.hairline },
  label: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  input: { height: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline,
    fontFamily: F.regular, fontSize: T.body, color: C.ink },
  fieldLabel: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3, marginTop: 4 },
  success: { fontFamily: F.medium, fontSize: T.small, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red },
  joinBtn: { height: 44, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", marginTop: 4 },
  joinText: { fontFamily: F.semibold, fontSize: T.body, color: "#fff" },
  empty: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, textAlign: "center", marginTop: 24 },
});
