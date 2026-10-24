import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiClient } from "../../../api/client";
import type {
  HomeschoolAttendance,
  HomeschoolSubject,
} from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { ChoiceGroup } from "../../../components/ChoiceGroup";
import { InlineNotice } from "../../../components/InlineNotice";
import { useModuleAccess } from "../../../modules/ModuleAccessContext";
import { colors } from "../../../styles/colors";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { formatError } from "../../../utils/format";
import { previousAttendanceDay } from "../lib/attendanceDraft";

type Draft = { selected: boolean; present: boolean; comment: string };
export function AttendanceDayModal({
  householdId,
  childId,
  childName,
  date,
  subjects,
  records,
  onClose,
  onRefresh,
  onRecordSaved,
}: {
  householdId: number;
  childId: number;
  childName: string;
  date: string;
  subjects: HomeschoolSubject[];
  records: HomeschoolAttendance[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onRecordSaved: (record: HomeschoolAttendance) => void;
}) {
  const { canManage, canManageRef } = useModuleAccess();
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      subjects.map((subject) => {
        const existing = records.find(
          (record) =>
            record.household_id === householdId &&
            record.child_id === childId &&
            record.date === date &&
            record.subject_id === subject.id,
        );
        return [
          subject.id,
          {
            selected: !!existing,
            present: existing?.present ?? true,
            comment: existing?.comment ?? "",
          },
        ];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const running = useRef(false);
  const savedRef = useRef(false);
  const authGeneration = useRef(apiClient.authenticationGeneration);
  const mounted = useRef(true);
  const completed = useRef(new Map<number, string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const disabled = busy || saved || !canManage;
  function change(id: number, patch: Partial<Draft>) {
    if (running.current || savedRef.current || !canManageRef.current) return;
    setDrafts((previous) => ({
      ...previous,
      [id]: {
        ...(previous[id] ?? { selected: false, present: true, comment: "" }),
        ...patch,
      },
    }));
    setError(null);
    setMessage(null);
  }
  function copyPrevious() {
    if (disabled || running.current) return;
    const previous = previousAttendanceDay(records, householdId, childId, date);
    if (!previous.length) {
      setMessage("No earlier attendance for this child.");
      return;
    }
    const known = new Set(subjects.map((subject) => subject.id));
    setDrafts(
      Object.fromEntries(
        subjects.map((subject) => {
          const entry = previous.find(
            (record) => record.subject_id === subject.id,
          );
          return [
            subject.id,
            {
              selected: !!entry,
              present: entry?.present ?? true,
              comment: entry?.comment ?? "",
            },
          ];
        }),
      ),
    );
    const missing = previous
      .filter((record) => !known.has(record.subject_id))
      .map((record) => `Subject ${record.subject_id}`);
    setMessage(
      `Copied ${previous[0].date}. Review before saving.${missing.length ? ` Unavailable subjects could not be copied: ${missing.join(", ")}.` : ""}`,
    );
    setError(null);
  }
  async function save() {
    if (running.current || savedRef.current || !canManageRef.current) return;
    const entries = subjects.filter((subject) => drafts[subject.id]?.selected);
    if (!entries.length) {
      setError("Select at least one subject.");
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    let failed = 0;
    let failureMessage = "";
    for (const subject of entries) {
      if (!mounted.current) break;
      if (
        !canManageRef.current ||
        apiClient.authenticationGeneration !== authGeneration.current
      ) {
        failed += 1;
        failureMessage = "Your permission to edit has changed.";
        break;
      }
      const draft = drafts[subject.id];
      const signature = JSON.stringify([draft.present, draft.comment]);
      if (completed.current.get(subject.id) === signature) continue;
      try {
        const record = await apiClient.upsertHomeschoolAttendance({
          household_id: householdId,
          child_id: childId,
          subject_id: subject.id,
          date,
          present: draft.present,
          comment: draft.comment,
        });
        if (
          mounted.current &&
          apiClient.authenticationGeneration === authGeneration.current
        )
          onRecordSaved(record);
        completed.current.set(subject.id, signature);
      } catch (cause) {
        failed += 1;
        failureMessage = formatError(cause);
      }
    }
    if (!mounted.current) return;
    running.current = false;
    setBusy(false);
    if (
      !canManageRef.current ||
      apiClient.authenticationGeneration !== authGeneration.current
    ) {
      setError(
        "Your account or permission changed. Refresh to review saved entries.",
      );
      return;
    }
    if (failed) {
      setError(
        `Some attendance was not saved. Successful entries are kept; retry saves only unsaved or changed entries. ${failureMessage}`,
      );
      void onRefresh();
      return;
    }
    savedRef.current = true;
    setSaved(true);
    setMessage("Attendance saved.");
    void onRefresh();
    timer.current = setTimeout(() => {
      if (mounted.current) closeRef.current();
    }, 2500);
  }
  function close() {
    if (!running.current) closeRef.current();
  }
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View
        style={{ flex: 1, backgroundColor: colors.surface, paddingTop: 24 }}
        accessibilityViewIsModal
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 48 }}
        >
          <Text accessibilityRole="header" style={formStyles.rowTitle}>
            Attendance for {childName}
          </Text>
          <Text style={shellStyles.mutedText}>{date}</Text>
          <Text style={shellStyles.mutedText}>
            Select subjects, then review each status and comment. Unselected
            subjects are left unchanged.
          </Text>
          <ActionButton
            label="Copy previous day"
            onPress={copyPrevious}
            disabled={disabled}
            variant="secondary"
            requiresManage
          />
          <Text style={shellStyles.mutedText}>
            Copies this child’s most recent earlier recorded day, including
            across semester boundaries. Nothing is saved until you choose Save.
          </Text>
          {message ? (
            <View accessibilityLiveRegion="polite">
              <InlineNotice
                tone={saved ? "success" : "info"}
                message={message}
              />
            </View>
          ) : null}
          {error ? (
            <View accessibilityRole="alert">
              <InlineNotice tone="error" message={error} />
            </View>
          ) : null}
          {subjects.length === 0 ? (
            <Text style={shellStyles.mutedText}>
              Add a subject in Setup first.
            </Text>
          ) : null}
          {subjects.map((subject) => {
            const draft = drafts[subject.id] ?? {
              selected: false,
              present: true,
              comment: "",
            };
            return (
              <View key={subject.id} style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={subject.name}
                  accessibilityState={{ checked: draft.selected, disabled }}
                  disabled={disabled}
                  onPress={() =>
                    change(subject.id, { selected: !draft.selected })
                  }
                  style={formStyles.selectableRow}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      backgroundColor: subject.color,
                    }}
                  />
                  <Text style={formStyles.rowTitle}>
                    {subject.name}
                    {!subject.active ? " (inactive)" : ""}
                  </Text>
                  <Text style={formStyles.selectionMark}>
                    {draft.selected ? "Selected" : "Select"}
                  </Text>
                </Pressable>
                {draft.selected ? (
                  <>
                    <Text style={shellStyles.mutedText}>
                      {subject.name} status
                    </Text>
                    <ChoiceGroup
                      disabled={disabled}
                      value={draft.present ? "present" : "absent"}
                      options={[
                        { label: "Present", value: "present" },
                        { label: "Absent", value: "absent" },
                      ]}
                      onChange={(value) =>
                        change(subject.id, { present: value === "present" })
                      }
                    />
                    <TextInput
                      accessibilityLabel={`${subject.name} comment`}
                      editable={!disabled}
                      multiline
                      maxLength={2000}
                      value={draft.comment}
                      onChangeText={(comment) =>
                        change(subject.id, { comment })
                      }
                      placeholder="Comment"
                      style={[formStyles.input, formStyles.multilineInput]}
                    />
                  </>
                ) : null}
              </View>
            );
          })}
          <ActionButton
            label={busy ? "Saving..." : saved ? "Saved" : "Save Attendance"}
            disabled={
              disabled || !Object.values(drafts).some((draft) => draft.selected)
            }
            onPress={() => {
              void save();
            }}
            requiresManage
          />
          <ActionButton
            label={saved ? "Close" : "Cancel"}
            disabled={busy}
            onPress={close}
            variant="secondary"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
