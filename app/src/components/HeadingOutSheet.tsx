// "Go with friends": pick when you're leaving, say your name once, send the link. Its own small
// sheet (above the keyboard) instead of a form crammed into the spot details.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { savedName } from "../data/crews";
import { clock, isRecurring, whenLabel, otherDayPrefix } from "../lib/time";
import type { Spot } from "../lib/types";
import { color as C, font as F, radius as R, text as T } from "../theme";
import { Tap } from "./Tap";

type Option = { title: string; detail: string; at: Date };

const day = otherDayPrefix;

// Choices that fit this spot: for a night that's days away, times relative to doors; for tonight,
// soon; for something already on (or a standing deal), now-ish.
export function leaveOptions(spot: Spot, now = Date.now()): Option[] {
  const start = spot.start && !isRecurring(spot) ? Date.parse(spot.start) : NaN;
  const at = (ms: number) => new Date(ms);
  if (Number.isFinite(start) && start - now > 45 * 60e3) {
    const opts: Option[] = [];
    if (start - now < 6 * 3600e3) opts.push({ title: "Now", detail: clock(at(now)), at: at(now) });
    opts.push(
      { title: "An hour before", detail: `${day(at(start - 3600e3))}${clock(at(start - 3600e3))}`, at: at(start - 3600e3) },
      { title: "30 min before", detail: `${day(at(start - 1800e3))}${clock(at(start - 1800e3))}`, at: at(start - 1800e3) },
      { title: "When it starts", detail: `${day(at(start))}${clock(at(start))}`, at: at(start) },
    );
    return opts.filter((o) => o.at.getTime() >= now - 60e3).slice(0, 4);
  }
  return [
    { title: "Now", detail: clock(at(now)), at: at(now) },
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={s.wrap} pointerEvents="box-none">
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          {/* Backstop: the sheet's color runs past the bottom edge, so nothing behind it shows through */}
          <View pointerEvents="none" style={s.bleed} />
          <View style={s.grabber} />
          <Text style={s.title}>Go with friends</Text>
          <Text style={s.sub} numberOfLines={1}>{spot.venue}  ·  {whenLabel(spot)}</Text>

          {/* When to leave: one list, the choice on the left, its time on the right, a check on the pick */}
          <Text style={s.label}>When you're leaving</Text>
          <View accessibilityRole="radiogroup">
            {options.map((o, i) => {
              const on = i === pick;
              return (
                <Tap key={o.title} pressedScale={0.99} onPress={() => { Haptics.selectionAsync(); setPick(i); }}
                  style={[s.option, i > 0 && s.optionRule]} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  accessibilityLabel={`${o.title}, ${o.detail}`}>
                  <Text style={[s.optionTitle, on && s.optionTitleOn]} numberOfLines={1}>{o.title}</Text>
                  <Text style={[s.optionTime, on && s.optionTimeOn]} numberOfLines={1}>{o.detail}</Text>
                  <View style={s.check}>{on && <Feather name="check" size={18} color={C.ink} />}</View>
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
  sheet: { backgroundColor: C.surface, overflow: "visible", borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: 20, paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.d4 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.d4, marginBottom: 16 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  sub: { fontFamily: F.regular, fontSize: T.small, color: C.ink3, marginTop: 4 },
  bleed: { position: "absolute", left: -1, right: -1, bottom: -400, height: 400, backgroundColor: C.surface },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  optionRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  optionTitle: { flex: 1, fontFamily: F.medium, fontSize: T.body, color: C.ink2 },
  optionTitleOn: { fontFamily: F.semibold, color: C.ink },
  optionTime: { fontFamily: F.regular, fontSize: T.body, color: C.ink3, fontVariant: ["tabular-nums"] },
  optionTimeOn: { color: C.ink },
  check: { width: 20, alignItems: "flex-end" },
  label: { fontFamily: F.medium, fontSize: T.meta, color: C.ink3, marginTop: 24, marginBottom: 8 },
  input: { height: 48, borderRadius: R.md, paddingHorizontal: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline,
    fontFamily: F.regular, fontSize: T.body, color: C.ink },
  error: { fontFamily: F.medium, fontSize: T.small, color: C.red, marginTop: 8 },
  cta: { height: 54, borderRadius: R.pill, backgroundColor: C.accent, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaOff: { backgroundColor: C.fill },
  ctaText: { fontFamily: F.semibold, fontSize: T.body, color: C.onAccent },
});
