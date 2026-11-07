// The map surface App.tsx needs, implemented per platform:
//   ScoutMap.ios.tsx      Apple Maps via react-native-maps (no key; also runs in Expo Go)
//   ScoutMap.android.tsx  MapLibre + OpenFreeMap tiles (no key; Google Maps would need one)
// Metro picks the file by platform, so iOS never loads MapLibre's native module.
import type { ReactElement, ReactNode, Ref } from "react";

export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

export type ScoutMapRef = {
  fitTo(points: LatLng[], padding: Padding): void;
  flyTo(point: LatLng, zoom: number): void;
};

export type ScoutMapProps = {
  ref?: Ref<ScoutMapRef>;
  initialRegion: Region;
  showsUserLocation?: boolean;
  onRegionChange?: (region: Region) => void;
  onPress?: () => void;
  // Plan my night: the stops in order, drawn as a quiet dashed line under the pins.
  route?: LatLng[];
  children?: ReactNode;
};

export type ScoutMarkerProps = {
  coordinate: LatLng;
  onPress?: () => void;
  // Where the coordinate sits on the marker view: [0.5, 0.5] centers it.
  anchor?: { x: number; y: number };
  zIndex?: number;
  // True when the view changes after mount (e.g. the selected pin); lets iOS skip re-snapshotting.
  live?: boolean;
  children: ReactElement;
};
