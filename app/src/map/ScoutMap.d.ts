// Types for the platform files (ScoutMap.ios.tsx / ScoutMap.android.tsx). Metro picks the
// implementation at bundle time; TypeScript resolves this declaration.
import type { ScoutMapProps, ScoutMarkerProps } from "./types";
export declare function ScoutMap(props: ScoutMapProps): React.JSX.Element;
export declare function ScoutMarker(props: ScoutMarkerProps): React.JSX.Element;
export type { LatLng, Region, ScoutMapRef } from "./types";
