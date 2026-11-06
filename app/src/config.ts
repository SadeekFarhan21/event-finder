// Every setting the app reads, in one place. EXPO_PUBLIC_* values are inlined at build time
// (EAS env for release builds, app/.env.local in dev), so they must be read literally here.
import Constants from "expo-constants";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Dev only: the phone reaches the local server (/server) on the machine serving the bundle.
// hostUri looks like "192.168.1.20:8081"; swap the port. Release builds never fall back to it.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";

export const config = {
  supabase: supabaseUrl && supabaseKey ? { url: supabaseUrl, key: supabaseKey } : null,
  devApiUrl: __DEV__ ? (process.env.EXPO_PUBLIC_API_URL ?? `http://${devHost}:8787`) : null,
  // Public web pages: crew and spot invites, the download page.
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? "https://scout-download.vercel.app",
  // Android map tiles (OpenStreetMap data via OpenFreeMap; no key).
  mapStyleUrl: "https://tiles.openfreemap.org/styles/positron",
  // Web fallback when the phone has no maps app for a ride hand-off.
  directionsUrl: (destination: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
  // A request that takes longer than this is treated as a network failure.
  requestTimeoutMs: 20_000,
} as const;

// Shown instead of a broken app when a release build was made without its backend settings.
export const configError = !config.supabase && !config.devApiUrl
  ? "This build of Scout is missing its server settings." : null;
