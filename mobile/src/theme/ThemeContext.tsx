import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { applyThemeColors, themeDefinitions, themeIds, type ThemeId } from "../styles/colors";
import { refreshCardStyles } from "../styles/cards";
import { refreshFormStyles } from "../styles/forms";
import { refreshNavigationStyles } from "../styles/navigation";
import { refreshShellStyles } from "../styles/shell";
import { refreshAdminStyles } from "../features/admin/styles";
import { refreshAuthStyles } from "../features/auth/styles";
import { refreshChoreStyles } from "../features/chores/styles";
import { refreshHomeschoolStyles } from "../features/homeschool/styles";

const STORAGE_KEY = "family-manager-theme";
const ThemeContext = createContext<{ theme: ThemeId; setTheme: (theme: ThemeId) => void }>({ theme: "paper-pine", setTheme: () => undefined });

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && themeIds.includes(value as ThemeId);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("paper-pine");

  function apply(themeId: ThemeId) {
    applyThemeColors(themeId);
    refreshAdminStyles();
    refreshAuthStyles();
    refreshCardStyles();
    refreshChoreStyles();
    refreshFormStyles();
    refreshHomeschoolStyles();
    refreshNavigationStyles();
    refreshShellStyles();
    setThemeState(themeId);
  }

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (isThemeId(stored)) apply(stored);
    }).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme: (next: ThemeId) => {
      apply(next);
      void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  return { ...value, definition: themeDefinitions[value.theme] };
}
