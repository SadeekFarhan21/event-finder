// Map markers: single spots, numbered clusters, and the selected spot with its name.
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScoutMarker } from "../map/ScoutMap";
import type { Cluster } from "../lib/cluster";
import type { Spot } from "../lib/types";
import { CATEGORY, color as C, font as F, radius as R, shadow } from "../theme";

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
            <View style={[s.pin, only.partner && s.pinPartner]}>
              <Ionicons name={CATEGORY[only.category].icon} size={14} color="#fff" />
            </View>
          </ScoutMarker>
        ) : (
          <ScoutMarker key={c.key} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => onCluster(c.events)}>
            <View style={s.cluster}><Text style={s.clusterText}>{c.events.length}</Text></View>
          </ScoutMarker>
        );
      })}
      {active && (
        <ScoutMarker key={`active-${active.id}`} coordinate={{ latitude: active.lat, longitude: active.lng }} zIndex={999}
          anchor={{ x: 0.5, y: 0.3 }} live onPress={() => onActive(active)}>
          <View style={{ alignItems: "center" }}>
            <View style={s.pinActive}><Ionicons name={CATEGORY[active.category].icon} size={20} color={C.ink} /></View>
            <View style={s.label}><Text style={s.labelText} numberOfLines={1}>{active.venue}</Text></View>
          </View>
        </ScoutMarker>
      )}
    </>
  );
}

const s = StyleSheet.create({
  pin: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.2 },
  pinPartner: { borderColor: C.yellow, borderWidth: 3 },
  pinActive: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.yellow, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.25 },
  label: { marginTop: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.surface, maxWidth: 180, ...shadow },
  labelText: { fontFamily: F.semibold, fontSize: 12, color: C.ink },
  cluster: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ink, alignItems: "center", justifyContent: "center", ...shadow },
  clusterText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
});
