// One crew: when we're leaving, who's in, and the buttons that move the group:
// "On my way" (and ride), invite more, or bow out.
import { Share, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { crewInvite, leaveLabel, type Crew, type CrewStatus } from "../data/crews";
import { color as C, font as F, radius as R, text as T } from "../theme";
import { Tap } from "./Tap";

const STATUS: Record<CrewStatus, string> = { in: "Coming", on_way: "On the way", out: "Can't make it" };

export function CrewCard({ crew, showVenue, onStatus, onRide, onOpen }: {
  crew: Crew; showVenue?: boolean;
  onStatus: (code: string, s: CrewStatus) => void;
  onRide: (crew: Crew) => void;
  onOpen?: (crew: Crew) => void; // jump to the spot on the map
}) {
  const me = crew.members.find((m) => m.me);
  const coming = crew.members.filter((m) => m.status !== "out");
  const onWay = crew.members.filter((m) => m.status === "on_way").length;

  return (
    <View style={s.card}>
      <Tap pressedScale={onOpen ? 0.99 : 1} disabled={!onOpen} onPress={() => onOpen?.(crew)}>
        <Text style={s.meta}>
          Leaving {leaveLabel(crew.leaveAt).toLowerCase()}  ·  {coming.length} coming{onWay ? `  ·  ${onWay} on the way` : ""}
        </Text>
        {showVenue && <Text style={s.venue} numberOfLines={1}>{crew.venue}</Text>}
        {showVenue && <Text style={s.title} numberOfLines={1}>{crew.title}</Text>}
      </Tap>

      <View style={s.members}>
        {crew.members.map((m, i) => (
          <View key={i} style={[s.member, m.status === "out" && { opacity: 0.45 }]}
            accessibilityLabel={`${m.me ? "You" : m.name}, ${STATUS[m.status]}`}>
            <View style={[s.dot, m.status === "on_way" && { backgroundColor: C.yellow, borderColor: C.ink },
              m.status === "out" && { backgroundColor: C.hairline }]} />
            <Text style={s.memberText}>{m.me ? "You" : m.name}</Text>
          </View>
        ))}
      </View>

      <View style={s.actions}>
        {me?.status === "on_way" ? (
          <Tap style={[s.btn, s.btnQuiet]} onPress={() => onRide(crew)}>
            <Ionicons name="car-outline" size={17} color={C.ink} />
            <Text style={s.btnText}>Open ride</Text>
          </Tap>
        ) : (
          <Tap style={[s.btn, s.btnQuiet]} onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onStatus(crew.code, "on_way");
            onRide(crew);
          }}>
            <Ionicons name="car-outline" size={17} color={C.ink} />
            <Text style={s.btnText}>I'm on my way</Text>
          </Tap>
        )}
        <Tap style={[s.btn, s.btnQuiet]} accessibilityLabel="Invite to crew"
          onPress={() => Share.share({ message: crewInvite(crew) }).catch(() => {})}>
          <Ionicons name="person-add-outline" size={17} color={C.ink} />
          <Text style={s.btnText}>Invite</Text>
        </Tap>
      </View>
      {me && me.status !== "out" && (
        <Tap style={s.out} onPress={() => onStatus(crew.code, "out")}>
          <Text style={s.outText}>Can't make it</Text>
        </Tap>
      )}
      {me?.status === "out" && (
        <Tap style={s.out} onPress={() => onStatus(crew.code, "in")}>
          <Text style={s.outText}>I'm back in</Text>
        </Tap>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, borderRadius: R.lg, backgroundColor: C.fill, gap: 12 },
  meta: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  venue: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink, marginTop: 4 },
  title: { fontFamily: F.regular, fontSize: T.small, color: C.ink2 },
  members: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  member: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 30, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ink, borderWidth: 1, borderColor: C.ink },
  memberText: { fontFamily: F.medium, fontSize: T.small, color: C.ink },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 44, borderRadius: R.pill, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  btnQuiet: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  btnText: { fontFamily: F.semibold, fontSize: T.small, color: C.ink },
  out: { alignSelf: "center", minHeight: 44, paddingHorizontal: 16, justifyContent: "center" },
  outText: { fontFamily: F.medium, fontSize: T.small, color: C.ink3 },
});
