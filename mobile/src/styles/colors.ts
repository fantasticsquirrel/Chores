export const themeIds = ["paper-pine", "clearline", "orbit-club"] as const;
export type ThemeId = (typeof themeIds)[number];

export type ThemeColors = {
  background: string; surface: string; surfaceMuted: string; surfaceSoft: string;
  border: string; borderStrong: string; text: string; textMuted: string; textSubtle: string;
  primary: string; primarySoft: string; primaryBorder: string; accent: string;
  warningText: string; warningSurface: string; warningBorder: string;
  danger: string; dangerSurface: string; dangerBorder: string;
  successText: string; successSurface: string; successBorder: string;
  chipSurface: string; chipBorder: string; chipText: string;
};

export const themeDefinitions: Record<ThemeId, { label: string; description: string; dark: boolean; colors: ThemeColors }> = {
  "paper-pine": { label: "Paper & Pine", description: "Warm and grounded", dark: false, colors: {
    background: "#f3eee2", surface: "#fffdf6", surfaceMuted: "#f7f3e8", surfaceSoft: "#e4eddc", border: "#d8d4c6", borderStrong: "#b8b5a8", text: "#19342d", textMuted: "#68766d", textSubtle: "#46564d", primary: "#173c32", primarySoft: "#e4eddc", primaryBorder: "#315b4e", accent: "#ec6b4f", warningText: "#8a4b09", warningSurface: "#fff3d6", warningBorder: "#e8c66f", danger: "#b83c3c", dangerSurface: "#fff0ed", dangerBorder: "#eab2aa", successText: "#2f654e", successSurface: "#e5f1e6", successBorder: "#bdd8c1", chipSurface: "#fde7df", chipBorder: "#efb6a6", chipText: "#8f3827",
  }},
  clearline: { label: "Clearline", description: "Crisp and focused", dark: false, colors: {
    background: "#f4f7fb", surface: "#ffffff", surfaceMuted: "#f7f9fc", surfaceSoft: "#e8eefb", border: "#dbe2ee", borderStrong: "#bdc8da", text: "#17213c", textMuted: "#6c7892", textSubtle: "#43506b", primary: "#356dff", primarySoft: "#e8efff", primaryBorder: "#6f94ff", accent: "#f04f78", warningText: "#8b5800", warningSurface: "#fff6dc", warningBorder: "#edd18b", danger: "#cf345c", dangerSurface: "#fff0f4", dangerBorder: "#efb3c3", successText: "#18765b", successSurface: "#e8f7f1", successBorder: "#aee0cd", chipSurface: "#edf1fb", chipBorder: "#cfd9ef", chipText: "#35466e",
  }},
  "orbit-club": { label: "Orbit Club", description: "Bold and playful", dark: true, colors: {
    background: "#211e39", surface: "#2c2849", surfaceMuted: "#27233f", surfaceSoft: "#3c365f", border: "#4e476c", borderStrong: "#6b628a", text: "#fff9ef", textMuted: "#bcb4d3", textSubtle: "#d5cee7", primary: "#d8ff5f", primarySoft: "#405026", primaryBorder: "#d8ff5f", accent: "#806df0", warningText: "#ffe69b", warningSurface: "#554522", warningBorder: "#9c8134", danger: "#ff6b73", dangerSurface: "#542e40", dangerBorder: "#a85167", successText: "#d8ff5f", successSurface: "#334327", successBorder: "#708d3e", chipSurface: "#4a407b", chipBorder: "#806df0", chipText: "#ffffff",
  }},
};

export const colors: ThemeColors = { ...themeDefinitions["paper-pine"].colors };

export function applyThemeColors(theme: ThemeId) {
  Object.assign(colors, themeDefinitions[theme].colors);
}
