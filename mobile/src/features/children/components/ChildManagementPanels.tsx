import { colors } from "../../../styles/colors";
import { Pressable, Text, TextInput, View } from "react-native";

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
          autoFocus
          editable={!mutations.submitting}
          maxLength={255}
          onChangeText={mutations.setNameInput}
          placeholder="Avery"
          placeholderTextColor={colors.textSubtle}
          style={formStyles.input}
          value={mutations.nameInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => mutations.setActiveOnCreate(!mutations.activeOnCreate)}
          style={[
            formStyles.selectableRow,
            mutations.activeOnCreate ? formStyles.selectableRowSelected : null,
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
          requiresManage
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

export function ChildrenListPanel({
  state,
  selectedChildId,
  onSelect,
  mutations,
}: {
  state: ChildrenState;
  selectedChildId: number | null;
  onSelect: (childId: number) => void;
  mutations: UseChildMutationsResult;
}) {
  return (
    <SectionCard title="Children">
      {state.loading ? <LoadingRow label="Loading children" /> : null}
      {state.error ? (
        <InlineNotice
          tone="error"
          message={`Could not load children: ${state.error}`}
        />
      ) : null}
      {!state.loading && !state.error && state.children.length === 0 ? (
        <Text style={shellStyles.mutedText}>No children found yet.</Text>
      ) : null}
      {state.children.map((child) => {
        const isUpdating = mutations.updatingChildId === child.id;
        return (
          <View key={child.id} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{child.name}</Text>
                <Text style={formStyles.rowMeta}>
                  {child.active ? "Active" : "Inactive"}
                </Text>
                <Text style={formStyles.rowMeta}>
                  {child.has_login === true
                    ? "Login linked"
                    : child.has_login === false
                      ? "No login linked"
                      : "Login status unavailable"}
                </Text>
              </View>
              <View style={formStyles.inlineButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Manage login for ${child.name}`}
                  accessibilityState={{
                    selected: selectedChildId === child.id,
                  }}
                  onPress={() => onSelect(child.id)}
                  style={formStyles.selectableRow}
                >
                  <Text style={formStyles.rowTitle}>
                    {selectedChildId === child.id
                      ? "Close login tools"
                      : "Manage login"}
                  </Text>
                </Pressable>
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
                  requiresManage
                  variant={child.active ? "danger" : "secondary"}
                />
              </View>
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}
