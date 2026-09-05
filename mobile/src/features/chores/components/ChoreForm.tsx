import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { Child } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { ChoiceGroup } from "../../../components/ChoiceGroup";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";
import {
  assignmentOptions,
  completionOptions,
  type MobileChoreFormState,
  scheduleOptions,
  scheduleUnitOptions,
} from "../lib/chorePresentation";

export function ChoreForm({
  activeChildren,
  editingId,
  form,
  onCancel,
  onSubmit,
  setField,
  setForm,
  showInterval,
  submitError,
  submitting,
}: {
  activeChildren: Child[];
  editingId: number | null;
  form: MobileChoreFormState;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
  setField: <K extends keyof MobileChoreFormState>(
    key: K,
    value: MobileChoreFormState[K],
  ) => void;
  setForm: Dispatch<SetStateAction<MobileChoreFormState>>;
  showInterval: boolean;
  submitError: string | null;
  submitting: boolean;
}) {
  function toggleAllowedChild(childId: number): void {
    setField(
      "allowed_child_ids",
      form.allowed_child_ids.includes(childId)
        ? form.allowed_child_ids.filter((id) => id !== childId)
        : [...form.allowed_child_ids, childId],
    );
  }

  function toggleRotationChild(childId: number): void {
    setField(
      "rotation_order",
      form.rotation_order.includes(childId)
        ? form.rotation_order.filter((id) => id !== childId)
        : [...form.rotation_order, childId],
    );
  }

  function moveRotation(index: number, direction: -1 | 1): void {
    const next = [...form.rotation_order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) {
      return;
    }
    [next[index], next[swap]] = [next[swap], next[index]];
    setField("rotation_order", next);
  }

  return (
    <SectionCard title={editingId !== null ? "Edit Chore" : "New Chore"}>
      <View style={styles.compactStack}>
        <FieldLabel label="Used by" />
        <ChoiceGroup
          disabled={submitting || editingId !== null}
          onChange={(value) =>
            setField("task_scope", value as "CHILD" | "PARENT")
          }
          options={[
            { label: "Children (reward)", value: "CHILD" },
            { label: "My account (to-do)", value: "PARENT" },
          ]}
          value={form.task_scope}
        />
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={(value) => setField("name", value)}
          placeholder="Take out trash"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.name}
        />
        {form.task_scope === "CHILD" ? (
          <>
            <FieldLabel label="Reward ($)" />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setField("reward_dollars", value)}
              style={styles.input}
              value={form.reward_dollars}
            />
          </>
        ) : (
          <InlineNotice
            tone="info"
            message="Parent chores are personal to-dos and do not affect child balances."
          />
        )}
        <FieldLabel label="Start Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => setField("start_date", value)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.start_date}
        />
        <FieldLabel label="Global End Date" />
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => setField("expires_at", value)}
          placeholder="Optional YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.expires_at}
        />
        <FieldLabel label="Completion Window Days" />
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => setField("timeout_days", value)}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={form.timeout_days}
        />
        <FieldLabel label="Schedule" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) =>
            setForm((previous) => ({
              ...previous,
              schedule_mode: value,
              schedule_interval:
                value === "EVERY" || value === "AFTER_COMPLETION"
                  ? previous.schedule_interval
                  : "",
            }))
          }
          options={scheduleOptions}
          value={form.schedule_mode}
        />
        {showInterval ? (
          <>
            <FieldLabel label="Interval" />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setField("schedule_interval", value)}
              placeholder="1"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={form.schedule_interval}
            />
            <FieldLabel label="Interval Unit" />
            <ChoiceGroup
              disabled={submitting}
              onChange={(value) => setField("schedule_unit", value)}
              options={scheduleUnitOptions}
              value={form.schedule_unit}
            />
          </>
        ) : null}
        <FieldLabel label="Completion" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) => setField("completion_mode", value)}
          options={completionOptions}
          value={form.completion_mode}
        />
        <FieldLabel label="Assignment" />
        <ChoiceGroup
          disabled={submitting}
          onChange={(value) =>
            setForm((previous) => ({
              ...previous,
              assignment_mode: value,
              allowed_child_ids:
                value === "ROTATING" ? [] : previous.allowed_child_ids,
              rotation_order: value === "STATIC" ? [] : previous.rotation_order,
            }))
          }
          options={assignmentOptions}
          value={form.assignment_mode}
        />
        {form.assignment_mode === "STATIC" ? (
          <>
            <Text style={styles.mutedText}>
              Leave every child unselected to allow all active children.
            </Text>
            {activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => toggleAllowedChild(child.id)}
                style={[
                  styles.selectableRow,
                  form.allowed_child_ids.includes(child.id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <Text style={styles.rowTitle}>{child.name}</Text>
                <Text
                  style={[
                    styles.selectionMark,
                    form.allowed_child_ids.includes(child.id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {form.allowed_child_ids.includes(child.id)
                    ? "Allowed"
                    : "Any"}
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {activeChildren.map((child) => (
              <Pressable
                accessibilityRole="button"
                key={child.id}
                onPress={() => toggleRotationChild(child.id)}
                style={[
                  styles.selectableRow,
                  form.rotation_order.includes(child.id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <Text style={styles.rowTitle}>{child.name}</Text>
                <Text
                  style={[
                    styles.selectionMark,
                    form.rotation_order.includes(child.id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {form.rotation_order.includes(child.id)
                    ? "In rotation"
                    : "Add"}
                </Text>
              </Pressable>
            ))}
            {form.rotation_order.map((childId, index) => {
              const childName =
                activeChildren.find((child) => child.id === childId)?.name ??
                `#${childId}`;
              return (
                <View key={childId} style={styles.reviewItem}>
                  <Text style={styles.rowTitle}>
                    {index + 1}. {childName}
                  </Text>
                  <View style={styles.inlineButtons}>
                    <ActionButton
                      compact
                      disabled={index === 0}
                      label="Up"
                      onPress={() => moveRotation(index, -1)}
                      variant="secondary"
                    />
                    <ActionButton
                      compact
                      disabled={index === form.rotation_order.length - 1}
                      label="Down"
                      onPress={() => moveRotation(index, 1)}
                      variant="secondary"
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}
        {submitError !== null ? (
          <InlineNotice tone="error" message={submitError} />
        ) : null}
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={submitting}
            label={submitting ? "Saving..." : "Save Chore"}
            onPress={() => {
              void onSubmit();
            }}
          />
          <ActionButton
            compact
            disabled={submitting}
            label="Cancel"
            onPress={onCancel}
            variant="secondary"
          />
        </View>
      </View>
    </SectionCard>
  );
}
