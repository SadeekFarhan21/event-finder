// Android: MapLibre with OpenFreeMap's Positron style (OpenStreetMap data). No API key needed,
// unlike Google Maps, which react-native-maps uses on Android and which crashes a release
// build without one.
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import Animated, { FadeOut } from "react-native-reanimated";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HEADER_GAP, HEADER_H } from "../layout";
import { color as C, font as F } from "../theme";
import { Camera, Layer, Map, Marker, UserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import type { Region, ScoutMapProps, ScoutMarkerProps } from "./types";
import { config } from "../config";

const STYLE = config.mapStyleUrl;

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

  const insets = useSafeAreaInsets();
  // Until the dark style arrives MapLibre paints its default cream background, a bright flash at night.
  // Cover the map in the night colour until the style has loaded. The fallback is long (20 s): at 4 s it
  // lifted mid-load on slow connections and showed the cream map anyway. Load errors lift it at once.
  const [styled, setStyled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStyled(true), 20000); return () => clearTimeout(t); }, []);
  // MapLibre's own attribution button is a bright blue "i"; credit OpenStreetMap in the palette instead.
  return (
    <View style={StyleSheet.absoluteFill}>
    <Map style={StyleSheet.absoluteFill} mapStyle={STYLE} logo={false} compass={false} attribution={false}
      onPress={() => onPress?.()}
      onDidFinishLoadingStyle={() => setStyled(true)} onDidFailLoadingMap={() => setStyled(true)}
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
      {showsUserLocation && (
        // "You are here" in the palette (MapLibre's default puck is a stock blue).
        <UserLocation>
          <Layer type="circle" id="scout-me-halo" source="mlrn-user-location"
            paint={{ "circle-radius": 14, "circle-color": C.ink, "circle-opacity": 0.14, "circle-pitch-alignment": "map" }} />
          <Layer type="circle" id="scout-me-ring" source="mlrn-user-location"
            paint={{ "circle-radius": 7, "circle-color": C.ink, "circle-pitch-alignment": "map" }} />
          <Layer type="circle" id="scout-me-dot" source="mlrn-user-location"
            paint={{ "circle-radius": 4, "circle-color": C.bg, "circle-pitch-alignment": "map" }} />
        </UserLocation>
      )}
      {children}
    </Map>
    {!styled && <Animated.View pointerEvents="none" exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />}
    <Text style={[s.credit, { top: insets.top + HEADER_GAP + HEADER_H + 6 }]} onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      accessibilityRole="link">© OpenStreetMap · OpenFreeMap</Text>
    </View>
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

const s = StyleSheet.create({
  // A dark backing so the credit never collides with a map label behind it ("LA CANADA FLINTRIDGE").
  credit: { position: "absolute", right: 12, fontFamily: F.regular, fontSize: 10, color: C.ink3, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(12,12,10,0.8)" },
});
