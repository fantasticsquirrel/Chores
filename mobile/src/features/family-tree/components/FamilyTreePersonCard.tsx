import { useRef, type RefObject } from "react";
import { Text, View } from "react-native";
import {
  birthBandAccent,
  type GraphNode,
  type ListRow,
} from "@family-manager/family-tree-core";
import { useTheme } from "../../../theme/ThemeContext";
import { useBirthBandColors } from "../hooks/useBirthBandColors";
import { FamilyTreeButton } from "./FamilyTreeControls";

interface BranchAction {
  label: string;
  disabled: boolean;
  onPress: () => void;
}
interface FamilyTreePersonCardProps {
  row: ListRow;
  focusPersonId: number | null;
  names: ReadonlyMap<number, GraphNode>;
  crossRowKeys: ReadonlySet<string>;
  branches: readonly BranchAction[];
  onSelectPerson: (id: number) => void;
  onPersonTrigger?: (ref: RefObject<View | null>) => void;
  disabled?: boolean;
  onFocusPerson: (id: number) => void;
}
/** Display only pre-indexed relationships; never scan all people for candidates. */
export function FamilyTreePersonCard({
  row,
  focusPersonId,
  names,
  crossRowKeys,
  branches,
  onSelectPerson,
  onPersonTrigger,
  disabled = false,
  onFocusPerson,
}: FamilyTreePersonCardProps) {
  const {
    definition: { colors, dark },
  } = useTheme();
  const { node, birthYear, relationships } = row;
  const trigger = useRef<View>(null);
  const preferences = useBirthBandColors();
  const accent = birthBandAccent(birthYear.bucket, preferences.custom);
  return (
    <View
      testID={`family-tree-person-${node.id}`}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor:
          focusPersonId === node.id
            ? colors.primaryBorder
            : colors.borderStrong,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 8,
      }}
    >
      <FamilyTreeButton
        label={`Select ${node.label}`}
        selected={focusPersonId === node.id}
        buttonRef={trigger}
        disabled={disabled}
        onPress={() => {
          onPersonTrigger?.(trigger);
          onSelectPerson(node.id);
        }}
      >
        {focusPersonId === node.id ? "✓ " : ""}
        {node.label}
      </FamilyTreeButton>
      <View
        testID={`family-tree-birth-accent-${node.id}`}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: dark ? accent.dark : accent.light,
          borderStyle: accent.pattern,
          paddingLeft: 8,
        }}
      >
        <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
          {birthYear.label}
        </Text>
        {birthYear.bucket.kind === "years" ? (
          <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
            {accent.label}
          </Text>
        ) : null}
      </View>
      <FamilyTreeButton
        label={`Show ${node.label} in tree`}
        disabled={disabled}
        onPress={() => onFocusPerson(node.id)}
      />
      {branches.map((action) => (
        <FamilyTreeButton key={action.label} {...action} />
      ))}
      {relationships.length ? (
        relationships.map((relationship) => (
          <Text
            key={relationship.key}
            style={{ color: colors.text, fontSize: 15 }}
          >
            {relationship.label} →{" "}
            {names.get(relationship.otherId)?.label ?? "Person unavailable"} —{" "}
            {relationship.pattern}
            {crossRowKeys.has(relationship.key)
              ? " · cross-generation partnership"
              : ""}
          </Text>
        ))
      ) : (
        <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
          No displayed relationships.
        </Text>
      )}
    </View>
  );
}
