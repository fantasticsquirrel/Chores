import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShell } from "./src/AppShell";
import { ThemeProvider } from "./src/theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider><AppShell /></ThemeProvider>
    </SafeAreaProvider>
  );
}
