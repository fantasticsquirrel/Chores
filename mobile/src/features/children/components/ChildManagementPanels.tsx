import { Pressable, Text, TextInput, View } from "react-native";

import type { Child } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { LoadingRow } from "../../../components/LoadingRow";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type { UseChildMutationsResult } from "../hooks/useChildMutations";
import type { ChildrenState } from "../hooks/useChildren";

export function AddChildPanel({
  mutations,
}: {
  mutations: UseChildMutationsResult;
}) {
  return (
    <>
      <SectionCard title="Add Child">
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={mutations.setNameInput}
          placeholder="Avery"
          placeholderTextColor="#94a3b8"
          style={formStyles.input}
          value={mutations.nameInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            mutations.setActiveOnCreate(!mutations.activeOnCreate)
          }
          style={[
            formStyles.selectableRow,
            mutations.activeOnCreate
              ? formStyles.selectableRowSelected
              : null,
          ]}
        >
          <Text style={formStyles.rowTitle}>Active on create</Text>
          <Text
            style={[
              formStyles.selectionMark,
              mutations.activeOnCreate
                ? formStyles.selectionMarkSelected
                : null,
            ]}
          >
            {mutations.activeOnCreate ? "Yes" : "No"}
          </Text>
        </Pressable>
        <ActionButton
          disabled={mutations.submitting}
          label={mutations.submitting ? "Saving..." : "Create Child"}
          onPress={mutations.createChild}
        />
      </SectionCard>

      {mutations.submitError !== null ? (
        <InlineNotice tone="error" message={mutations.submitError} />
      ) : null}
      {mutations.submitSuccess !== null ? (
        <InlineNotice tone="success" message={mutations.submitSuccess} />
      ) : null}
    </>
  );
}

export function ChildSelectionPanel({
  onSelect,
  selectedChildId,
  state,
}: {
  onSelect: (childId: number) => void;
  selectedChildId: number | null;
  state: ChildrenState;
}) {
  return (
    <SectionCard title="Select Child">
      {state.loading ? <LoadingRow label="Loading children" /> : null}
      {!state.loading && state.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load children: ${state.error}`}
        />
      ) : null}
      {!state.loading && state.children.length === 0 ? (
        <Text style={shellStyles.mutedText}>No children found yet.</Text>
      ) : null}
      <View>
        {state.children.map((child) => (
          <Pressable
            accessibilityRole="button"
            key={child.id}
            onPress={() => onSelect(child.id)}
            style={[
              formStyles.selectableRow,
              selectedChildId === child.id
                ? formStyles.selectableRowSelected
                : null,
            ]}
          >
            <View style={formStyles.rowMain}>
              <Text style={formStyles.rowTitle}>{child.name}</Text>
              <Text style={formStyles.rowMeta}>
                {child.active ? "Active" : "Inactive"}
              </Text>
            </View>
            <Text
              style={[
                formStyles.selectionMark,
                selectedChildId === child.id
                  ? formStyles.selectionMarkSelected
                  : null,
              ]}
            >
              {selectedChildId === child.id ? "Selected" : "Select"}
            </Text>
          </Pressable>
        ))}
      </View>
    </SectionCard>
  );
}

export function ChildrenListPanel({
  children,
  mutations,
}: {
  children: Child[];
  mutations: UseChildMutationsResult;
}) {
  return (
    <SectionCard title="Children">
      {children.map((child) => {
        const isUpdating = mutations.updatingChildId === child.id;
        return (
          <View key={child.id} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{child.name}</Text>
                <Text style={formStyles.rowMeta}>
                  {child.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <ActionButton
                compact
                disabled={isUpdating}
                label={
                  isUpdating
                    ? "Updating"
                    : child.active
                      ? "Set Inactive"
                      : "Set Active"
                }
                onPress={() => mutations.toggleActive(child)}
                variant={child.active ? "danger" : "secondary"}
              />
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}
