import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Category } from "./lib/types";

// Five colors, on purpose: a warm neutral ramp, Yelo yellow (the one primary: main actions and
// the selected spot), Yelo blue (deals only), and red (errors only). Neutrals lean slightly toward
// the yellow instead of pure gray. Text tokens are checked for WCAG AA (4.5:1) on white and n50.
const neutral = {
  n50: "#FBFAF6", n100: "#F4F2EA", n200: "#E8E5D9", n300: "#D5D1C3", n400: "#B4AFA0",
  n500: "#8E897B", n600: "#6B665A", n700: "#4F4B42", n800: "#33302A", n900: "#1A1814",
};

export const color = {
  ...neutral,
  bg: neutral.n50,
  surface: "#FFFFFF",
  fill: neutral.n100, // quiet buttons, image placeholders
  hairline: neutral.n200, // dividers and borders
  ink: neutral.n900, // 17.7:1
  ink2: neutral.n700, // secondary text, 8.7:1
  ink3: neutral.n600, // metadata, 5.7:1 (was #9A968C at 2.9:1, below AA)
  placeholder: neutral.n500, // input placeholders and disabled only
  yellow: "#FFE600",
  blue: "#1F4FFF",
  red: "#B42318",
  scrim: "rgba(26,24,20,0.28)", // dims the map behind the spot sheet
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
  shadowColor: neutral.n900,
  shadowOpacity: 0.12,
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
