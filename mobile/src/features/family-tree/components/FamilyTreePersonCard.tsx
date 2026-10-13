import { useRef, type RefObject } from "react";
import { Text, View } from "react-native";
import type { GraphNode, ListRow } from "@family-manager/family-tree-core";
import { useTheme } from "../../../theme/ThemeContext";
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
    definition: { colors },
  } = useTheme();
  const { node, birthYear, relationships } = row;
  const trigger = useRef<View>(null);
  return (
    <View
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
      <Text style={{ color: colors.textSubtle, fontSize: 15 }}>
        {birthYear.label}
      </Text>
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
