import { useId, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import {
  birthBandAccent,
  type BirthBandAccent,
  type ListRow,
} from "@family-manager/family-tree-core";
import { useTheme } from "../../../theme/ThemeContext";
import { useBirthBandColors } from "../hooks/useBirthBandColors";
import { FamilyTreeButton } from "./FamilyTreeControls";

function AccentEditor({ band }: { band: BirthBandAccent }) {
  const preferences = useBirthBandColors();
  const { definition: { colors } } = useTheme();
  const [draft, setDraft] = useState(preferences.custom[band.key] ?? "");
  const [error, setError] = useState(false);
  const id = useId();
  const target = band.key === "unknown"
    ? "unknown birth year" : band.label.toLowerCase();
  return (
    <View style={{ gap: 8, minWidth: 0 }}>
      <Text nativeID={id} style={{ color: colors.text, fontSize: 16 }}>
        Accent for {target}
      </Text>
      <TextInput
        accessibilityLabel={`Accent for ${target}`}
        accessibilityLabelledBy={id}
        value={draft}
        maxLength={32}
        placeholder="#RRGGBB"
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setDraft}
        style={{
          minHeight: 44,
          minWidth: 44,
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          borderWidth: 1,
          borderRadius: 12,
          padding: 10,
        }}
      />
      <FamilyTreeButton
        label={`Apply accent for ${target}`}
        onPress={() => setError(!preferences.apply(band.key, draft))}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: 16 }}
        >
          Use #RGB or #RRGGBB (opaque hex color).
        </Text>
      ) : null}
    </View>
  );
}
export function BirthBandColorControls({ rows }: { rows: readonly ListRow[] }) {
  const preferences = useBirthBandColors();
  const { definition: { colors } } = useTheme();
  const [open, setOpen] = useState(false);
  const bands = useMemo(() => {
    const unique = new Map<string, BirthBandAccent>();
    for (const row of rows) {
      const band = birthBandAccent(row.birthYear.bucket);
      unique.set(band.key, band);
    }
    return [...unique.values()].sort((a, b) =>
      a.key.localeCompare(b.key, "en", { numeric: true }),
    );
  }, [rows]);
  return (
    <View style={{ gap: 12, minWidth: 0 }}>
      <FamilyTreeButton
        label={`${open ? "Hide" : "Show"} birth-band colors`}
        expanded={open}
        onPress={() => setOpen((current) => !current)}
      />
      {open ? (
        <>
          <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
            Accents group birth years in 25-year bands, not family generations.
            Unknown birth years use a dashed accent. Text and card backgrounds
            keep the current theme. Changes last only in this household session.
          </Text>
          {bands.map((band) => (
            <AccentEditor
              key={`${preferences.resetVersion}:${band.key}`}
              band={band}
            />
          ))}
          <FamilyTreeButton
            label="Reset birth-band colors"
            onPress={preferences.reset}
          />
        </>
      ) : null}
    </View>
  );
}
