import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ScoutScreen } from "./src/screens/ScoutScreen";
import { color as C } from "./src/theme";

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      {fontsLoaded ? <ScoutScreen /> : <View />}
    </GestureHandlerRootView>
  );
}
