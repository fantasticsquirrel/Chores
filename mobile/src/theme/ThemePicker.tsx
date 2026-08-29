import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, themeDefinitions, themeIds } from "../styles/colors";
import { useTheme } from "./ThemeContext";

const swatches = {
  "paper-pine": ["#173c32", "#ec6b4f"],
  clearline: ["#111b38", "#356dff"],
  "orbit-club": ["#17152b", "#d8ff5f"],
} as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return <View accessibilityRole="radiogroup" style={pickerStyles.group}>
    {themeIds.map((id) => {
      const active = theme === id;
      return <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        key={id}
        onPress={() => setTheme(id)}
        style={[pickerStyles.option, { backgroundColor: colors.surfaceMuted, borderColor: active ? colors.primary : colors.border, borderWidth: active ? 2 : 1 }]}
      >
        <View style={pickerStyles.swatches}><View style={[pickerStyles.swatch,{backgroundColor:swatches[id][0]}]} /><View style={[pickerStyles.swatch,{backgroundColor:swatches[id][1]}]} /></View>
        <View style={pickerStyles.copy}><Text style={[pickerStyles.label,{color:colors.text}]}>{themeDefinitions[id].label}</Text><Text style={[pickerStyles.description,{color:colors.textMuted}]}>{themeDefinitions[id].description}</Text></View>
      </Pressable>;
    })}
  </View>;
}

const pickerStyles = StyleSheet.create({
  group: { gap: 9 }, option: { alignItems: "center", borderRadius: 12, flexDirection: "row", minHeight: 58, paddingHorizontal: 12, paddingVertical: 9 },
  swatches: { flexDirection: "row", width: 50 }, swatch: { borderColor: "#ffffff", borderRadius: 16, borderWidth: 2, height: 30, marginRight: -7, width: 30 },
  copy: { marginLeft: 8 }, label: { fontSize: 15, fontWeight: "800" }, description: { fontSize: 12, marginTop: 2 },
});
