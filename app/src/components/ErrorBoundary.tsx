// Last line of defense: a render crash anywhere shows a calm screen with a way back, instead of
// a blank white app. Reload restarts the JS bundle (and picks up a fixed update if one landed).
import { Component, type ReactNode } from "react";
import { DevSettings, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { reportError } from "../lib/report";
import { color as C, font as F, radius as R, text as T } from "../theme";
import { Tap } from "./Tap";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError(error, { componentStack: info.componentStack });
  }

  reload = () => {
    if (__DEV__) DevSettings.reload();
    else Updates.reloadAsync().catch(() => this.setState({ error: null }));
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <Fallback title="Something went wrong." body="Scout hit a problem it couldn't recover from. Reloading usually fixes it." action="Reload Scout" onAction={this.reload} />;
  }
}

// Also used for a build that's missing its server settings (see config.ts).
export function Fallback({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.root} accessibilityRole="alert">
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {action && onAction && (
        <Tap style={s.btn} onPress={onAction}><Text style={s.btnText}>{action}</Text></Tap>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  title: { fontFamily: F.display, fontSize: T.title, lineHeight: 32, color: C.ink },
  body: { fontFamily: F.regular, fontSize: T.body, lineHeight: 24, color: C.ink2 },
  btn: { alignSelf: "flex-start", height: 44, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.ink, justifyContent: "center", marginTop: 8 },
  btnText: { fontFamily: F.semibold, fontSize: T.small, color: C.surface },
});
