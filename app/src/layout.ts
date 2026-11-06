// Screen geometry shared by the carousel and the controls that sit above it.
import { Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export const SCREEN_W = width;
export const CARD_W = width - 64;
export const CARD_GAP = 12;
export const CARD_STEP = CARD_W + CARD_GAP; // one swipe
export const CARD_INSET = (width - CARD_W) / 2; // left edge of a centered card
export const CAROUSEL_BOTTOM = 32;
export const MEDIA_H = 112; // the photo (or its stand-in) at the top of a card
export const CARD_H = MEDIA_H + 112 + 8; // photo + venue/details/ride row + shadow room; controls stack above it
// Header below the status bar: search row (48) + chip row (12 + 32 + 8).
export const HEADER_GAP = 8; // between the safe-area edge and the search bar
export const HEADER_H = 100;
