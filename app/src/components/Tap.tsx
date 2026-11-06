// Every tappable surface in the app: a quick spring down on press, back on release.
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  children: ReactNode;
};

export function Tap({ style, pressedScale = 0.97, onPressIn, onPressOut, accessibilityRole = "button", children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable {...rest} accessibilityRole={accessibilityRole} style={[style, animated]}
      onPressIn={(e) => { scale.value = withSpring(pressedScale, SPRING); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, SPRING); onPressOut?.(e); }}>
      {children}
    </AnimatedPressable>
  );
}
