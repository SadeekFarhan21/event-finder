// Screen geometry shared by the carousel and the controls that sit above it.
import { Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export const SCREEN_W = width;
export const CARD_W = width - 64;
export const CARD_GAP = 10;
export const CARD_STEP = CARD_W + CARD_GAP; // one swipe
export const CARD_INSET = (width - CARD_W) / 2; // left edge of a centered card
export const CAROUSEL_BOTTOM = 34;
export const CARD_H = 112; // carousel card height incl. shadow room, for stacking controls above it
