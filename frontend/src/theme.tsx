/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactElement, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export const themeIds = ["paper-pine", "clearline", "orbit-club"] as const;
export type ThemeId = (typeof themeIds)[number];

export const themes: Record<ThemeId, { label: string; description: string }> = {
  "paper-pine": { label: "Paper & Pine", description: "Warm and grounded" },
  clearline: { label: "Clearline", description: "Crisp and focused" },
  "orbit-club": { label: "Orbit Club", description: "Bold and playful" },
};

const STORAGE_KEY = "family-manager-theme";

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && themeIds.includes(value as ThemeId);
}

function initialTheme(): ThemeId {
  if (typeof window === "undefined") return "paper-pine";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeId(stored) ? stored : "paper-pine";
}

const ThemeContext = createContext<{ theme: ThemeId; setTheme: (theme: ThemeId) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

export function ThemePicker({ compact = false }: { compact?: boolean }): ReactElement {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className={`theme-picker${compact ? " theme-picker--compact" : ""}`}>
      <legend>Appearance</legend>
      <div className="theme-picker-options">
        {themeIds.map((id) => (
          <button
            aria-pressed={theme === id}
            className={`theme-option theme-option--${id}${theme === id ? " active" : ""}`}
            key={id}
            onClick={() => setTheme(id)}
            type="button"
          >
            <span className="theme-option-swatch" aria-hidden="true" />
            <span><strong>{themes[id].label}</strong>{compact ? null : <small>{themes[id].description}</small>}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
