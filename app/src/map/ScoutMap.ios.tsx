// iOS: Apple Maps through react-native-maps. No API key, and it runs in Expo Go.
import { useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import type { ScoutMapProps, ScoutMarkerProps } from "./types";

// Apple's dark map is navy and can't be restyled. A world-sized warm near-black wash, drawn as a map
// overlay (below every pin), pulls it toward Scout's palette and quiets the labels.
const WORLD = [
  { latitude: 85, longitude: -180 }, { latitude: 85, longitude: 0 }, { latitude: 85, longitude: 180 },
  { latitude: -85, longitude: 180 }, { latitude: -85, longitude: 0 }, { latitude: -85, longitude: -180 },
];

export function ScoutMap({ ref, initialRegion, showsUserLocation, onRegionChange, onPress, route, children }: ScoutMapProps) {
  const map = useRef<MapView>(null);
  useImperativeHandle(ref, () => ({
    fitTo: (points, padding) => map.current?.fitToCoordinates(points, { edgePadding: padding, animated: true }),
    flyTo: (point, zoom) => map.current?.animateCamera({ center: point, zoom }, { duration: 500 }),
  }), []);

  return (
    <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initialRegion} userInterfaceStyle="dark"
      mapType="mutedStandard" showsPointsOfInterests={false} showsCompass={false} toolbarEnabled={false}
      showsUserLocation={showsUserLocation} onRegionChangeComplete={onRegionChange} onPress={onPress}>
      <Polygon coordinates={WORLD} fillColor="rgba(12,12,10,0.55)" strokeWidth={0} tappable={false} zIndex={-1} />
      {route && route.length > 1 && <Polyline coordinates={route} strokeColor="rgba(242,240,233,0.7)" strokeWidth={2} lineDashPattern={[2, 5]} lineCap="round" zIndex={0} />}
      {children}
    </MapView>
  );
}

export function ScoutMarker({ coordinate, onPress, anchor, zIndex, live, children }: ScoutMarkerProps) {
  return (
    <Marker coordinate={coordinate} anchor={anchor} zIndex={zIndex} tracksViewChanges={!!live}
      onPress={(ev) => { ev.stopPropagation(); onPress?.(); }}>
      {children}
    </Marker>
  );
}
