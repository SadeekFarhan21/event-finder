// One name per city. Spots are stored and rate-limited by city, so "nyc", "New York" and
// "Brooklyn" must all land on the same key or each spelling becomes its own empty map
// (and its own paid scout run). Keep in sync with supabase/functions/_shared/cities.ts.

const ALIASES: [RegExp, string][] = [
  [/^(nyc|ny|new york( city)?|manhattan|brooklyn|queens|bronx|williamsburg|bushwick)(,?\s*(ny|new york|usa?))?$/, "New York, NY"],
  [/^(l\.?a\.?|los angeles|hollywood|west hollywood|weho|westwood|santa monica|koreatown|ktown|silver lake|dtla)(,?\s*(ca|california|usa?))?$/, "Los Angeles, CA"],
];

// Display name: "nyc " -> "New York, NY"; unknown cities are tidied, not rejected.
export function canonicalCity(input: string) {
  const t = input.trim().replace(/\s+/g, " ");
  const k = t.toLowerCase().replace(/\.$/, "");
  for (const [re, name] of ALIASES) if (re.test(k)) return name;
  return t;
}

// Storage key, e.g. "new york, ny".
export const cityKey = (input: string) => canonicalCity(input).toLowerCase();
