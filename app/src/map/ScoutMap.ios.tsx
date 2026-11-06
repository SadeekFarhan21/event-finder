// iOS: Apple Maps through react-native-maps. No API key, and it runs in Expo Go.
import { useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { ScoutMapProps, ScoutMarkerProps } from "./types";

export function ScoutMap({ ref, initialRegion, showsUserLocation, onRegionChange, onPress, children }: ScoutMapProps) {
  const map = useRef<MapView>(null);
  useImperativeHandle(ref, () => ({
    fitTo: (points, padding) => map.current?.fitToCoordinates(points, { edgePadding: padding, animated: true }),
    flyTo: (point, zoom) => map.current?.animateCamera({ center: point, zoom }, { duration: 500 }),
  }), []);

  return (
    <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initialRegion} userInterfaceStyle="dark"
      mapType="mutedStandard" showsPointsOfInterests={false} showsCompass={false} toolbarEnabled={false}
      showsUserLocation={showsUserLocation} onRegionChangeComplete={onRegionChange} onPress={onPress}>
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
