// Map markers: single spots, numbered clusters, and the selected spot with its name.
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScoutMarker } from "../map/ScoutMap";
import type { Cluster } from "../lib/cluster";
import type { Spot } from "../lib/types";
import { CATEGORY, color as C, font as F, radius as R, shadow, text as T } from "../theme";

type Props = {
  clusters: Cluster[];
  active: Spot | null;
  onSpot: (spot: Spot) => void;
  onCluster: (spots: Spot[]) => void;
  onActive: (spot: Spot) => void;
};

export function SpotPins({ clusters, active, onSpot, onCluster, onActive }: Props) {
  return (
    <>
      {clusters.map((c) => {
        const only = c.events.length === 1 ? c.events[0] : null;
        return only ? (
          <ScoutMarker key={only.id} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => onSpot(only)}>
            <View style={[s.pin, only.partner && s.pinPartner]} accessible accessibilityRole="button"
              accessibilityLabel={`${only.venue}, ${CATEGORY[only.category].label}${only.partner ? ", Yelo partner" : ""}`}>
              <Ionicons name={CATEGORY[only.category].icon} size={14} color={C.surface} />
            </View>
          </ScoutMarker>
        ) : (
          <ScoutMarker key={c.key} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => onCluster(c.events)}>
            <View style={[s.cluster, clusterSize(c.events.length), c.events.some((e) => e.partner) && s.clusterPartner]}
              accessible accessibilityRole="button" accessibilityLabel={`${c.events.length} spots close together. Zoom in`}><Text style={s.clusterText}>{c.events.length}</Text></View>
          </ScoutMarker>
        );
      })}
      {active && (
        <ScoutMarker key={`active-${active.id}`} coordinate={{ latitude: active.lat, longitude: active.lng }} zIndex={999}
          anchor={{ x: 0.5, y: 0.3 }} live onPress={() => onActive(active)}>
          <View style={{ alignItems: "center" }}>
            <View style={s.pinActive}><Ionicons name={CATEGORY[active.category].icon} size={20} color={C.onAccent} /></View>
            <View style={s.label}><Text style={s.labelText} numberOfLines={1}>{active.venue}</Text></View>
          </View>
        </ScoutMarker>
      )}
    </>
  );
}

// Busier clusters read bigger, so the map shows where the night is at a glance:
// 2 spots -> 30px, ~8 -> 38px, 25+ -> 44px.
const clusterSize = (n: number) => {
  const d = Math.round(24 + Math.min(14, Math.log2(n) * 3));
  return { minWidth: d, height: d, borderRadius: d / 2 };
};

const s = StyleSheet.create({
  pin: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, borderWidth: 2, borderColor: C.surface, alignItems: "center", justifyContent: "center", ...shadow },
  // Yelo partners wear the yellow ring (an ink ring vanished into the ink pin).
  pinPartner: { borderColor: C.accent, borderWidth: 3 },
  // A bubble holding a Yelo partner keeps the partner's ring, so partners read at every zoom.
  clusterPartner: { borderColor: C.accent, borderWidth: 2 },
  pinActive: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, borderWidth: 3, borderColor: C.bg, alignItems: "center", justifyContent: "center", ...shadow },
  label: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.surface, maxWidth: 180, ...shadow },
  labelText: { fontFamily: F.semibold, fontSize: T.meta, color: C.ink },
  cluster: { paddingHorizontal: 6, backgroundColor: "rgba(21,21,19,0.82)", borderWidth: 1, borderColor: C.d4, alignItems: "center", justifyContent: "center", ...shadow },
  clusterText: { fontFamily: F.medium, fontSize: T.meta, color: C.ink2, fontVariant: ["tabular-nums"] },
});
