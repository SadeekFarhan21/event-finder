import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Category } from "./lib/types";

// Night palette: Scout is used at night, on the way out. Monochrome warm near-blacks plus ONE
// accent (Yelo yellow), the way a professional dark UI is built:
//   d0..d4  surfaces from the page up (each step a little lighter, so depth reads without shadows)
//   ink..ink3  text, from primary to metadata (all >= 4.5:1 on surface)
//   accent  Yelo yellow, only for the main action, the selected spot and Yelo partners
//   red     errors only
// `ink` and `surface` are opposites, so "ink background + surface text" is an inverted chip
// that stays legible; text on yellow uses `onAccent`.
const neutral = {
  d0: "#0C0C0A", d1: "#151513", d2: "#1D1C19", d3: "#282723", d4: "#3A3833",
};
export const color = {
  ...neutral,
  bg: neutral.d0,
  surface: neutral.d1, // cards, sheet, inputs
  fill: neutral.d2, // quiet buttons, image placeholders
  hairline: neutral.d3, // dividers and borders
  strong: neutral.d4, // borders that must read (selected outlines)
  ink: "#F2F0E9", // 16.9:1 on surface
  ink2: "#C2BEB2", // secondary text, 10:1
  ink3: "#8E8A7F", // metadata, 5.4:1
  placeholder: "#6B675E", // input placeholders and disabled only
  accent: "#FFE14A", // Yelo yellow, warmed slightly so it doesn't buzz on black
  onAccent: "#14130F",
  red: "#FF7A6B",
  scrim: "rgba(0,0,0,0.55)", // dims the map behind the spot sheet
};

// Instrument Serif is the display face on joinyelo.com; Inter does the rest.
export const font = {
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic", // one accent word in screen titles
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Spacing: paddings, margins and gaps step through 4, 8, 12, 16, 20, 24, 32 and nothing in between.

export const radius = { sm: 8, md: 12, lg: 16, sheet: 20, pill: 999 };

// Five sizes, nothing in between: meta (eyebrows, counts), small (buttons, secondary text),
// body (reading text, inputs), title (card names), display (sheet and screen titles).
export const text = { meta: 12, small: 14, body: 16, title: 28, display: 40 };

// Only for things floating over the map (header, pills, carousel cards): short and crisp, not a
// soft glow. Surfaces on the page background use a hairline border instead.
export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};

type IconName = ComponentProps<typeof Ionicons>["name"];

export const CATEGORY: Record<Category, { label: string; icon: IconName }> = {
  nightlife: { label: "Nightlife", icon: "disc-outline" },
  music: { label: "Live music", icon: "musical-notes-outline" },
  food_drink: { label: "Food & drink", icon: "restaurant-outline" },
  arts: { label: "Arts & comedy", icon: "color-palette-outline" },
  sports: { label: "Sports", icon: "basketball-outline" },
  community: { label: "Community", icon: "people-outline" },
  deal: { label: "Deals", icon: "pricetag-outline" },
};
