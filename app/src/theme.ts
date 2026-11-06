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
};

// Instrument Serif is the display face on joinyelo.com; Inter does the rest.
export const font = {
  display: "InstrumentSerif_400Regular",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const shadow = {
  shadowColor: "#1B1A14",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
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
