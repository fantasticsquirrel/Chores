import { Pressable, Text, TextInput, View } from "react-native";

import type { Child, EligibleChore } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { LoadingRow } from "../../../components/LoadingRow";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type { ChildrenState, EligibleChildState } from "../hooks/useChoreData";
import { eligibleTimingLabel } from "../lib/chorePresentation";

export function DailyChoreBoardPanel({
  childrenState,
  onDateChange,
  onRefresh,
  onToday,
  targetDate,
}: {
  childrenState: ChildrenState;
  onDateChange: (date: string) => void;
  onRefresh: () => Promise<void>;
  onToday: () => void;
  targetDate: string;
}) {
  return (
    <SectionCard subtitle={targetDate} title="Daily Board">
      <TextInput
        autoCapitalize="none"
        onChangeText={onDateChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        style={formStyles.input}
        value={targetDate}
      />
      <View style={formStyles.inlineButtons}>
        <ActionButton
          compact
          label="Today"
          onPress={onToday}
          variant="secondary"
        />
        <ActionButton
          compact
          disabled={childrenState.loading}
          label={childrenState.loading ? "Refreshing" : "Refresh"}
          onPress={() => {
            void onRefresh();
          }}
          variant="secondary"
        />
      </View>
      {childrenState.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load children: ${childrenState.error}`}
        />
      ) : null}
    </SectionCard>
  );
}

export function ChoreEligibilityPanel({
  activeChildren,
  childrenState,
  getEligibleState,
  onQuickSubmit,
}: {
  activeChildren: Child[];
  childrenState: ChildrenState;
  getEligibleState: (childId: number) => EligibleChildState;
  onQuickSubmit: (child: Child, chore: EligibleChore) => Promise<void>;
}) {
  if (childrenState.loading) {
    return (
      <SectionCard title="Available Chores">
        <LoadingRow label="Loading children and available chores" />
      </SectionCard>
    );
  }

  if (activeChildren.length === 0) {
    return (
      <SectionCard title="Available Chores">
        <Text style={shellStyles.mutedText}>No active children found.</Text>
      </SectionCard>
    );
  }

  return activeChildren.map((child) => {
    const childState = getEligibleState(child.id);
    return (
      <SectionCard
        key={child.id}
        subtitle={`${childState.chores.length} available`}
        title={child.name}
      >
        {childState.loading ? <LoadingRow label="Loading chores" /> : null}
        {childState.error !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not load chores: ${childState.error}`}
          />
        ) : null}
        {!childState.loading &&
        childState.error === null &&
        childState.chores.length === 0 ? (
          <Text style={shellStyles.mutedText}>
            No chores available for this date.
          </Text>
        ) : null}
        {childState.chores.map((chore) => (
          <View key={chore.chore_id} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{chore.name}</Text>
                <Text style={formStyles.rowMeta}>{eligibleTimingLabel(chore)}</Text>
              </View>
              <ActionButton
                compact
                disabled={childState.submittingChoreId !== null}
                label={
                  childState.submittingChoreId === chore.chore_id
                    ? "Submitting"
                    : "Submit"
                }
                onPress={() => {
                  void onQuickSubmit(child, chore);
                }}
                variant="secondary"
              />
            </View>
          </View>
        ))}
        {childState.message !== null ? (
          <InlineNotice tone="success" message={childState.message} />
        ) : null}
      </SectionCard>
    );
  });
}

export function SelectedChoreSubmitPanel({
  activeChildren,
  onChildSelect,
  onChoreToggle,
  onSubmit,
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
  selectedChild: Child | null;
  selectedChildId: number | null;
  selectedChoreIds: number[];
  selectedEligibleState: EligibleChildState;
  submitError: string | null;
  submitSuccess: string | null;
  submitting: boolean;
}) {
  return (
    <SectionCard
      subtitle={`${selectedChoreIds.length} selected`}
      title="Selected Child Submit"
    >
      <FieldLabel label="Child" />
      <View>
        {activeChildren.map((child) => (
          <Pressable
            accessibilityRole="button"
            key={child.id}
            onPress={() => onChildSelect(child.id)}
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
      </View>
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
      {selectedEligibleState.chores.map((chore) => (
        <Pressable
          accessibilityRole="button"
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
            <Text style={formStyles.rowMeta}>{eligibleTimingLabel(chore)}</Text>
          </View>
          <Text
            style={[
              formStyles.selectionMark,
              selectedChoreIds.includes(chore.chore_id)
                ? formStyles.selectionMarkSelected
                : null,
            ]}
          >
            {selectedChoreIds.includes(chore.chore_id) ? "Selected" : "Select"}
          </Text>
        </Pressable>
      ))}
      <ActionButton
        disabled={
          submitting || selectedChild === null || selectedChoreIds.length === 0
        }
        label={submitting ? "Submitting..." : "Submit Selected"}
        onPress={() => {
          void onSubmit();
        }}
      />
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
