import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Category } from "./api";

// One small system: a warm neutral ramp, Yelo yellow for the primary action and the
// selected spot, Yelo blue only for deals. Everything else stays black/gray.
export const color = {
  bg: "#FAF8F2",
  surface: "#FFFFFF",
  ink: "#111111",
  ink2: "#5E5B53",
  ink3: "#9A968C",
  hairline: "#E8E4D8",
  fill: "#F2EFE6",
  yellow: "#FFE600",
  blue: "#1F4FFF",
  green: "#178A4C",
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
