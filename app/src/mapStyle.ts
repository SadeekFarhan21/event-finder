// Muted Google Maps style for Android (iOS uses Apple's "mutedStandard" map type).
// Warm-gray land, quiet roads, no business POIs, so the spots are the only loud thing on the map.
export const ANDROID_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f4f2ec" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a867c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f4f2ec" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#e6ecdc" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ece8dc" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d9e3e8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9aa7ad" }] },
];
