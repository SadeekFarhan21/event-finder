// "Go with friends": pick when you're leaving, say your name once, send the link. Its own small
// sheet (above the keyboard) instead of a form crammed into the spot details.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { savedName } from "../data/crews";
import { clock, isRecurring } from "../lib/time";
import type { Spot } from "../lib/types";
import { color as C, font as F, radius as R, text as T } from "../theme";
import { Tap } from "./Tap";

type Option = { title: string; detail: string; at: Date };

const day = (d: Date) => (new Date().toDateString() === d.toDateString() ? "" : `${d.toLocaleDateString(undefined, { weekday: "short" })} `);

// Choices that fit this spot: for a night that's days away, times relative to doors; for tonight,
// soon; for something already on (or a standing deal), now-ish.
export function leaveOptions(spot: Spot, now = Date.now()): Option[] {
  const start = spot.start && !isRecurring(spot) ? Date.parse(spot.start) : NaN;
  const at = (ms: number) => new Date(ms);
  if (Number.isFinite(start) && start - now > 45 * 60e3) {
    const opts: Option[] = [];
    if (start - now < 6 * 3600e3) opts.push({ title: "Now", detail: "Head out together right away", at: at(now) });
    opts.push(
      { title: "An hour before", detail: `${day(at(start - 3600e3))}${clock(at(start - 3600e3))}`, at: at(start - 3600e3) },
      { title: "30 min before", detail: `${day(at(start - 1800e3))}${clock(at(start - 1800e3))}`, at: at(start - 1800e3) },
      { title: "When it starts", detail: `${day(at(start))}${clock(at(start))}`, at: at(start) },
    );
    return opts.filter((o) => o.at.getTime() >= now - 60e3).slice(0, 4);
  }
  return [
    { title: "Now", detail: "Head out together right away", at: at(now) },
    { title: "In 30 min", detail: clock(at(now + 1800e3)), at: at(now + 1800e3) },
    { title: "In an hour", detail: clock(at(now + 3600e3)), at: at(now + 3600e3) },
  ];
}

export function HeadingOutSheet({ spot, visible, onStart, onClose }: {
  spot: Spot; visible: boolean; onStart: (leaveAt: Date, name: string) => Promise<void>; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const options = useMemo(() => leaveOptions(spot), [spot.id, visible]);
  const [pick, setPick] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setPick(Math.min(options.length - 1, options[0]?.title === "Now" && options.length > 2 ? 2 : 0));
    savedName().then((n) => n && setName((cur) => cur || n));
  }, [visible]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStart(options[pick].at, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message || "Couldn't start the crew. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.wrap} pointerEvents="box-none">
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={s.grabber} />
          <Text style={s.title}>Go with friends</Text>
          <Text style={s.sub} numberOfLines={1}>{spot.venue}. Pick when you're leaving.</Text>

          <View style={s.options}>
            {options.map((o, i) => {
              const on = i === pick;
              return (
                <Tap key={o.title} pressedScale={0.99} onPress={() => { Haptics.selectionAsync(); setPick(i); }}
                  style={[s.option, on && s.optionOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionTitle}>{o.title}</Text>
                    <Text style={s.optionDetail}>{o.detail}</Text>
                  </View>
                  <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                </Tap>
              );
            })}
          </View>

          <Text style={s.label}>Your name, as friends will see it</Text>
          <TextInput value={name} onChangeText={setName} placeholder="First name" placeholderTextColor={C.placeholder}
            selectionColor={C.selection} cursorColor={C.accent} style={s.input} maxLength={30} autoCapitalize="words"
            returnKeyType="done" accessibilityLabel="Your first name" />
          {error && <Text style={s.error}>{error}</Text>}

          <Tap style={[s.cta, !name.trim() && s.ctaOff]} disabled={!name.trim() || busy} onPress={start}>
            {busy ? <ActivityIndicator color={C.onAccent} /> : (
              <>
                <Ionicons name="paper-plane" size={16} color={name.trim() ? C.onAccent : C.ink3} />
                <Text style={[s.ctaText, !name.trim() && { color: C.ink3 }]}>Start crew and send link</Text>
              </>
            )}
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.scrim },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: 20, paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.d4, marginBottom: 16 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  sub: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: 4 },
  options: { marginTop: 16, gap: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: R.md,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline },
  optionOn: { borderColor: C.ink2, backgroundColor: C.d2 },
  optionTitle: { fontFamily: F.semibold, fontSize: T.body, color: C.ink },
  optionDetail: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.d4, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink },
  label: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3, marginTop: 20, marginBottom: 8 },
  input: { height: 50, borderRadius: R.md, paddingHorizontal: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline,
    fontFamily: F.regular, fontSize: T.body, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red, marginTop: 8 },
  cta: { height: 54, borderRadius: R.pill, backgroundColor: C.accent, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaOff: { backgroundColor: C.fill },
  ctaText: { fontFamily: F.semibold, fontSize: T.body, color: C.onAccent },
});
