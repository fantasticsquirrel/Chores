import { Text, TextInput, View } from "react-native";
import type { DiscoveryExploration } from "@family-manager/family-api/models/discovery-lab";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
export type Filters = {
  q: string;
  subject: string;
  grade: string;
  tag: string;
};
export const emptyFilters: Filters = { q: "", subject: "", grade: "", tag: "" };
export function matches(item: DiscoveryExploration, filters: Filters) {
  return (
    (!filters.q ||
      `${item.title} ${item.summary} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(filters.q.toLowerCase())) &&
    (!filters.subject || item.subject === filters.subject) &&
    (!filters.grade || item.grade_bands.includes(filters.grade)) &&
    (!filters.tag || item.tags.includes(filters.tag))
  );
}
export function DiscoveryFilters({
  items,
  value,
  onChange,
}: {
  items: DiscoveryExploration[];
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const groups = [
    {
      key: "subject" as const,
      label: "Subject",
      options: [...new Set(items.map((i) => i.subject))],
    },
    {
      key: "grade" as const,
      label: "Grade band",
      options: [...new Set(items.flatMap((i) => i.grade_bands))],
    },
    {
      key: "tag" as const,
      label: "Tag",
      options: [...new Set(items.flatMap((i) => i.tags))],
    },
  ];
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        accessibilityLabel="Search Explorations"
        placeholder="Search Explorations"
        placeholderTextColor={colors.textMuted}
        value={value.q}
        onChangeText={(q) => onChange({ ...value, q })}
        style={{
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
        }}
      />
      {groups.map((group) => (
        <View key={group.key} style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {group.label}: {value[group.key] || "All"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <ActionButton
              compact
              label={`All ${group.label.toLowerCase()}s`}
              variant="secondary"
              onPress={() => onChange({ ...value, [group.key]: "" })}
            />
            {group.options.map((option) => (
              <ActionButton
                compact
                key={option}
                label={option}
                variant={value[group.key] === option ? "primary" : "secondary"}
                onPress={() => onChange({ ...value, [group.key]: option })}
              />
            ))}
          </View>
        </View>
      ))}
      <ActionButton
        label="Reset filters"
        variant="secondary"
        onPress={() => onChange(emptyFilters)}
      />
    </View>
  );
}
