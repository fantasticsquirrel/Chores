import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import type { Child, EligibleChore } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { LoadingRow } from "../../../components/LoadingRow";
import { SectionCard } from "../../../components/SectionCard";
import { colors } from "../../../styles/colors";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type { ChildrenState, EligibleChildState } from "../hooks/useChoreData";
import { eligibleTimingLabel } from "../lib/chorePresentation";

export function DailyChoreBoardPanel({
  busy = false,
  childrenState,
  onDateChange,
  onRefresh,
  onToday,
  targetDate,
}: {
  busy?: boolean;
  childrenState: ChildrenState;
  onDateChange: (date: string) => void;
  onRefresh: () => Promise<void>;
  onToday: () => void;
  targetDate: string;
}) {
  return (
    <SectionCard subtitle={targetDate} title="Daily Board">
      <TextInput
        editable={!busy}
        accessibilityLabel="Date"
        autoCapitalize="none"
        onChangeText={onDateChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSubtle}
        style={formStyles.input}
        value={targetDate}
      />
      <View style={formStyles.inlineButtons}>
        <ActionButton
          compact
          disabled={busy}
          label="Today"
          onPress={onToday}
          variant="secondary"
        />
        <ActionButton
          compact
          disabled={busy || childrenState.loading}
          label={childrenState.loading ? "Refreshing" : "Refresh"}
          onPress={() => {
            void onRefresh();
          }}
          variant="secondary"
        />
      </View>
      {childrenState.loading ? (
        <LoadingRow label="Loading children and available chores" />
      ) : null}
      {childrenState.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load children: ${childrenState.error}`}
        />
      ) : null}
    </SectionCard>
  );
}

export function SelectedChoreSubmitPanel({
  activeChildren,
  onChildSelect,
  onChoreToggle,
  onSubmit,
  onQuickSubmit,
  targetDate,
  selectedChild,
  selectedChildId,
  selectedChoreIds,
  selectedEligibleState,
  submitError,
  submitSuccess,
  submitting,
}: {
  activeChildren: Child[];
  onChildSelect: (childId: number) => void;
  onChoreToggle: (choreId: number) => void;
  onSubmit: () => Promise<void>;
  onQuickSubmit: (child: Child, chore: EligibleChore) => Promise<void>;
  targetDate: string;
  selectedChild: Child | null;
  selectedChildId: number | null;
  selectedChoreIds: number[];
  selectedEligibleState: EligibleChildState;
  submitError: string | null;
  submitSuccess: string | null;
  submitting: boolean;
}) {
  const [multiple, setMultiple] = useState(false);
  const [choosingChild, setChoosingChild] = useState(false);
  const busy =
    submitting ||
    selectedEligibleState.loading ||
    selectedEligibleState.submittingChoreId !== null;
  return (
    <SectionCard
      subtitle={`${selectedChoreIds.length} selected`}
      title={
        selectedChild ? `${selectedChild.name}’s chores` : "Available chores"
      }
    >
      <FieldLabel label="Child" />
      <ActionButton
        label={
          selectedChild
            ? `Change child (${selectedChild.name})`
            : "Choose child"
        }
        disabled={busy || activeChildren.length === 0}
        onPress={() => setChoosingChild(true)}
        variant="secondary"
      />
      <Modal
        visible={choosingChild}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChoosingChild(false)}
      >
        <View
          accessibilityViewIsModal
          style={{ flex: 1, backgroundColor: colors.surface, paddingTop: 24 }}
        >
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text accessibilityRole="header" style={formStyles.rowTitle}>
              Select child
            </Text>
            {activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: selectedChildId === child.id,
                  disabled: busy,
                }}
                disabled={busy}
                key={child.id}
                onPress={() => {
                  onChildSelect(child.id);
                  setChoosingChild(false);
                }}
                style={[
                  formStyles.selectableRow,
                  selectedChildId === child.id
                    ? formStyles.selectableRowSelected
                    : null,
                ]}
              >
                <Text style={formStyles.rowTitle}>{child.name}</Text>
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
            <ActionButton
              label="Cancel"
              onPress={() => setChoosingChild(false)}
              variant="secondary"
            />
          </ScrollView>
        </View>
      </Modal>
      <ActionButton
        label={multiple ? "Quick submit mode" : "Select multiple"}
        disabled={busy}
        onPress={() => setMultiple(!multiple)}
        variant="secondary"
      />
      {activeChildren.length === 0 ? (
        <Text style={shellStyles.mutedText}>No active children found.</Text>
      ) : null}
      {selectedChild &&
      !selectedEligibleState.loading &&
      !selectedEligibleState.error &&
      selectedEligibleState.chores.length === 0 ? (
        <Text style={shellStyles.mutedText}>
          No chores available for {selectedChild.name} on {targetDate}.
        </Text>
      ) : null}
      {selectedEligibleState.message ? (
        <InlineNotice tone="success" message={selectedEligibleState.message} />
      ) : null}
      {selectedChild === null ? (
        <Text style={shellStyles.mutedText}>
          Select a child to submit multiple chores.
        </Text>
      ) : null}
      {selectedChild !== null && selectedEligibleState.loading ? (
        <LoadingRow label="Loading available chores" />
      ) : null}
      {selectedChild !== null && selectedEligibleState.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load chores: ${selectedEligibleState.error}`}
        />
      ) : null}
      {!selectedEligibleState.loading &&
        selectedEligibleState.chores.map((chore) =>
          multiple ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={chore.name}
              accessibilityState={{
                checked: selectedChoreIds.includes(chore.chore_id),
                disabled: busy,
              }}
              disabled={busy}
              key={chore.chore_id}
              onPress={() => onChoreToggle(chore.chore_id)}
              style={[
                formStyles.selectableRow,
                selectedChoreIds.includes(chore.chore_id)
                  ? formStyles.selectableRowSelected
                  : null,
              ]}
            >
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{chore.name}</Text>
                <Text style={formStyles.rowMeta}>
                  {eligibleTimingLabel(chore)}
                </Text>
              </View>
              <Text
                style={[
                  formStyles.selectionMark,
                  selectedChoreIds.includes(chore.chore_id)
                    ? formStyles.selectionMarkSelected
                    : null,
                ]}
              >
                {selectedChoreIds.includes(chore.chore_id)
                  ? "Selected"
                  : "Select"}
              </Text>
            </Pressable>
          ) : (
            <View key={chore.chore_id} style={formStyles.selectableRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{chore.name}</Text>
                <Text style={formStyles.rowMeta}>
                  {eligibleTimingLabel(chore)}
                </Text>
              </View>
              <ActionButton
                compact
                label={
                  selectedEligibleState.submittingChoreId === chore.chore_id
                    ? "Submitting"
                    : "Submit"
                }
                disabled={busy}
                requiresManage
                onPress={() =>
                  selectedChild
                    ? onQuickSubmit(selectedChild, chore)
                    : undefined
                }
              />
            </View>
          ),
        )}
      {multiple ? (
        <ActionButton
          disabled={
            busy || selectedChild === null || selectedChoreIds.length === 0
          }
          label={submitting ? "Submitting..." : "Submit Selected"}
          requiresManage
          onPress={() => {
            void onSubmit();
          }}
        />
      ) : null}
      {submitError !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not submit chores: ${submitError}`}
        />
      ) : null}
      {submitSuccess !== null ? (
        <InlineNotice tone="success" message={submitSuccess} />
      ) : null}
    </SectionCard>
  );
}
