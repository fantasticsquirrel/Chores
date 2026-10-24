import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { DiscoveryExploration } from "@family-manager/family-api/models/discovery-lab";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
export type Filters = { q: string; subject: string; grade: string; tag: string };
export const emptyFilters: Filters = { q: "", subject: "", grade: "", tag: "" };
export function matches(item: DiscoveryExploration, filters: Filters) {
  return (
    (!filters.q || `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase().includes(filters.q.toLowerCase())) &&
    (!filters.subject || item.subject === filters.subject) &&
    (!filters.grade || item.grade_bands.includes(filters.grade)) &&
    (!filters.tag || item.tags.includes(filters.tag))
  );
}
export function DiscoveryFilters({ items, value, onChange }: {
  items: DiscoveryExploration[]; value: Filters; onChange: (value: Filters) => void;
}) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const count = [value.grade, value.tag].filter(Boolean).length;
  const groups = [
    { key: "subject" as const, label: "Subject", options: [...new Set(items.map(i => i.subject))].sort() },
    { key: "grade" as const, label: "Grade band", options: [...new Set(items.flatMap(i => i.grade_bands))].sort() },
    { key: "tag" as const, label: "Tag", options: [...new Set(items.flatMap(i => i.tags))].sort() },
  ];
  return <View style={{ gap: 8 }}>
    <TextInput accessibilityLabel="Search Explorations" placeholder="Search Explorations" placeholderTextColor={colors.textMuted}
      value={value.q} onChangeText={q => onChange({ ...value, q })}
      style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: subjectOpen }} onPress={() => setSubjectOpen(open => !open)}
        style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        <Text style={{ color: colors.text }}>Subject: {value.subject || "All subjects"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }} onPress={() => setAdvanced(open => !open)}
        style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
        <Text style={{ color: colors.text }}>Filters ({count})</Text>
      </Pressable>
      {(value.q || value.subject || count > 0) && <ActionButton compact label="Reset filters" variant="secondary" onPress={() => onChange(emptyFilters)} />}
    </View>
    {count > 0 && <Text style={{ color: colors.text }}>{[value.grade && `Grades: ${value.grade}`, value.tag && `Tag: ${value.tag}`].filter(Boolean).join(" · ")}</Text>}
    {groups.filter(group => group.key === "subject" ? subjectOpen : advanced).map(group => <View key={group.key} style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{group.label}: {value[group.key] || "All"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {["", ...group.options].map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value[group.key] === option }}
          onPress={() => { onChange({ ...value, [group.key]: option }); if (group.key === "subject") setSubjectOpen(false); }}
          style={{ padding: 12, borderWidth: value[group.key] === option ? 2 : 1, borderColor: colors.border, borderRadius: 12 }}>
          <Text style={{ color: colors.text }}>{option || `All ${group.label.toLowerCase()}s`}</Text>
        </Pressable>)}
      </View>
    </View>)}
  </View>;
}
