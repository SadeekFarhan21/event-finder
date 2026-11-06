import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ScoutScreen } from "./src/screens/ScoutScreen";
import { ErrorBoundary, Fallback } from "./src/components/ErrorBoundary";
import { configError } from "./src/config";
import { color as C } from "./src/theme";

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          {configError ? <Fallback title="Scout can't start." body={configError} /> : fontsLoaded ? <ScoutScreen /> : <View />}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
