// "Heading out": pick when you're leaving, say your name once, and get a crew link to send.
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { savedName } from "../data/crews";
import type { Spot } from "../lib/types";
import { color as C, font as F, radius as R, text as T } from "../theme";
import { Tap } from "./Tap";

type Option = { label: string; at: Date };

// Leave-time choices that make sense for this spot: soon, or in time for it to start.
function options(spot: Spot): Option[] {
  const now = Date.now();
  const out: Option[] = [
    { label: "Now", at: new Date(now) },
    { label: "In 30 min", at: new Date(now + 30 * 60e3) },
    { label: "In 1 hr", at: new Date(now + 60 * 60e3) },
  ];
  const start = spot.start ? Date.parse(spot.start) : NaN;
  if (start - 30 * 60e3 > now + 75 * 60e3) {
    const at = new Date(start - 30 * 60e3); // half an hour before doors
    out.push({ label: `${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${new Date().toDateString() === at.toDateString() ? "" : ` ${at.toLocaleDateString(undefined, { weekday: "short" })}`}`, at });
  }
  return out;
}

export function StartCrew({ spot, onStart, onCancel }: {
  spot: Spot; onStart: (leaveAt: Date, name: string) => Promise<void>; onCancel: () => void;
}) {
  const choices = options(spot);
  const [pick, setPick] = useState(choices.length > 3 ? 3 : 1);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { savedName().then((n) => n && setName(n)); }, []);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStart(choices[pick].at, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message || "Couldn't start the crew");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.box}>
      <Text style={s.label}>Leaving</Text>
      <View style={s.chips}>
        {choices.map((o, i) => (
          <Tap key={o.label} style={[s.chip, i === pick && s.chipOn]} onPress={() => { Haptics.selectionAsync(); setPick(i); }}
            accessibilityState={{ selected: i === pick }}>
            <Text style={[s.chipText, i === pick && { color: C.surface }]}>{o.label}</Text>
          </Tap>
        ))}
      </View>
      <Text style={s.label}>Your name, for your friends</Text>
      <TextInput value={name} onChangeText={setName} placeholder="First name" placeholderTextColor={C.placeholder}
        style={s.input} maxLength={30} autoCapitalize="words" returnKeyType="done" />
      {error && <Text style={s.error}>{error}</Text>}
      <View style={s.row}>
        <Tap style={s.cancel} onPress={onCancel}><Text style={s.cancelText}>Cancel</Text></Tap>
        <Tap style={[s.start, !name.trim() && { opacity: 0.4 }]} disabled={!name.trim() || busy} onPress={go}>
          {busy ? <ActivityIndicator color={C.surface} size="small" /> : <Text style={s.startText}>Start crew & invite</Text>}
        </Tap>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: 16, borderRadius: R.lg, backgroundColor: C.fill, gap: 8 },
  label: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 44, paddingHorizontal: 12, borderRadius: R.pill, justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  input: { height: 44, borderRadius: R.md, paddingHorizontal: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline,
    fontFamily: F.regular, fontSize: T.body, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  cancel: { height: 44, paddingHorizontal: 16, justifyContent: "center" },
  cancelText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink3 },
  start: { flex: 1, height: 44, borderRadius: R.pill, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  startText: { fontFamily: F.semibold, fontSize: T.small, color: C.surface },
});
