// Android: MapLibre with OpenFreeMap's Positron style (OpenStreetMap data). No API key needed,
// unlike Google Maps, which react-native-maps uses on Android and which crashes a release
// build without one.
import { useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { Camera, Map, Marker, UserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import type { Region, ScoutMapProps, ScoutMarkerProps } from "./types";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

// react-native-maps regions use deltas; MapLibre uses zoom. Close enough for an initial view.
const zoomFor = (r: Region) => Math.log2(360 / Math.max(r.longitudeDelta, 0.0001));

export function ScoutMap({ ref, initialRegion, showsUserLocation, onRegionChange, onPress, children }: ScoutMapProps) {
  const camera = useRef<CameraRef>(null);
  useImperativeHandle(ref, () => ({
    fitTo: (points, padding) => {
      if (!points.length) return;
      const lats = points.map((p) => p.latitude), lngs = points.map((p) => p.longitude);
      camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding, duration: 600 });
    },
    flyTo: (point, zoom) => camera.current?.easeTo({ center: [point.longitude, point.latitude], zoom, duration: 500 }),
  }), []);

  return (
    <Map style={StyleSheet.absoluteFill} mapStyle={STYLE} logo={false} compass={false} attributionPosition={{ bottom: 8, left: 8 }}
      onPress={() => onPress?.()}
      onRegionDidChange={(ev) => {
        const [west, south, east, north] = ev.nativeEvent.bounds;
        onRegionChange?.({
          latitude: (south + north) / 2, longitude: (west + east) / 2,
          latitudeDelta: north - south, longitudeDelta: east - west,
        });
      }}>
      <Camera ref={camera} initialViewState={{
        center: [initialRegion.longitude, initialRegion.latitude], zoom: zoomFor(initialRegion),
      }} />
      {showsUserLocation && <UserLocation />}
      {children}
    </Map>
  );
}

export function ScoutMarker({ coordinate, onPress, anchor, zIndex, children }: ScoutMarkerProps) {
  return (
    <Marker lngLat={[coordinate.longitude, coordinate.latitude]} anchor={toAnchor(anchor)} style={{ zIndex }}
      onPress={(ev) => { ev.stopPropagation(); onPress?.(); }}>
      {children}
    </Marker>
  );
}

// MapLibre takes named anchors; the app only uses "centered" and "pin above its label".
const toAnchor = (a?: { x: number; y: number }) => (!a || a.y >= 0.5 ? "center" : "top");
