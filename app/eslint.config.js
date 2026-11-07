// Expo's lint rules, including React's rules of hooks (a hook below an early return crashed the
// spot sheet once; this catches it before it ships).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "android/*", "ios/*"] },
  {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // Apostrophes in <Text> are fine in React Native (this rule is about HTML).
      "react/no-unescaped-entities": "off",
      // Reanimated is built on assigning sharedValue.value; the compiler rules flag that by design.
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
