import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { FamilyTreeAliasInput } from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { InlineNotice } from "../../../components/InlineNotice";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { useDraftState } from "./DraftMemory";
import { formPayload, initialDraft, type Draft, type Field } from "./payload";
export function TreeTextField({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <View>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        style={[formStyles.input, multiline && formStyles.multilineInput]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        autoCapitalize="none"
      />
    </View>
  );
}
export function TreeChoice({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      <View style={formStyles.choiceGrid}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.replace(/_/g, " ")}`}
            accessibilityState={{ selected: value === option, disabled }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={[
              formStyles.choiceButton,
              { minHeight: 48, minWidth: 48, justifyContent: "center" },
              value === option && formStyles.choiceButtonSelected,
            ]}
          >
            <Text style={formStyles.choiceButtonText}>
              {value === option ? "✓ " : ""}
              {option.replace(/_/g, " ")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function TreeToggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[
        formStyles.choiceButton,
        { minHeight: 48, justifyContent: "center", marginTop: 8 },
      ]}
    >
      <Text style={formStyles.choiceButtonText}>
        {value ? "☑" : "☐"} {label}
      </Text>
    </Pressable>
  );
}
export function NativeFields({
  fields,
  draft,
  onChange,
  disabled = false,
}: {
  fields: Field[];
  draft: Draft;
  onChange: (key: string, value: unknown, touchKey?: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {fields.map((f) => {
        if (f.kind === "choice")
          return (
            <TreeChoice
              key={f.key}
              label={f.label}
              value={String(draft[f.key])}
              options={f.options!}
              onChange={(v) => onChange(f.key, v)}
              disabled={disabled}
            />
          );
        if (f.kind === "boolean")
          return (
            <TreeToggle
              key={f.key}
              label={f.label}
              value={draft[f.key] === true}
              onChange={(v) => onChange(f.key, v)}
              disabled={disabled}
            />
          );
        if (f.kind === "aliases") {
          const aliases = draft[f.key] as FamilyTreeAliasInput[];
          return (
            <View key={f.key}>
              <Text style={formStyles.fieldLabel}>{f.label}</Text>
              {aliases.map((a, i) => (
                <View key={i}>
                  <TreeTextField
                    label={`Alias ${i + 1} name`}
                    value={a.name}
                    onChange={(v) =>
                      onChange(
                        f.key,
                        aliases.map((item, n) =>
                          n === i ? { ...item, name: v } : item,
                        ),
                      )
                    }
                    disabled={disabled}
                  />
                  <TreeTextField
                    label={`Alias ${i + 1} label`}
                    value={a.label ?? ""}
                    onChange={(v) =>
                      onChange(
                        f.key,
                        aliases.map((item, n) =>
                          n === i ? { ...item, label: v } : item,
                        ),
                      )
                    }
                    disabled={disabled}
                  />
                  <ActionButton
                    label={`Remove alias ${i + 1}`}
                    disabled={disabled}
                    variant="secondary"
                    onPress={() =>
                      onChange(
                        f.key,
                        aliases.filter((_, n) => n !== i),
                      )
                    }
                  />
                </View>
              ))}
              <ActionButton
                label="Add alias"
                disabled={disabled}
                variant="secondary"
                onPress={() =>
                  onChange(f.key, [...aliases, { name: "", label: "" }])
                }
              />
            </View>
          );
        }
        return (
          <View key={f.key}>
            <TreeTextField
              label={
                f.label +
                (f.kind === "date" ? " (YYYY / YYYY-MM / YYYY-MM-DD)" : "")
              }
              value={String(draft[f.key] ?? "")}
              multiline={f.kind === "multiline"}
              onChange={(v) => onChange(f.key, v)}
              disabled={disabled}
            />
            {f.kind === "date" ? (
              <TreeToggle
                label={`${f.label} uncertain`}
                value={draft[`${f.key}_uncertain`] === true}
                onChange={(v) => onChange(`${f.key}_uncertain`, v, f.key)}
                disabled={disabled}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );
}
export function NativeEditor({
  fields,
  initial,
  patch = false,
  externallyDirty = false,
  disabled = false,
  onDirty,
  onSubmit,
  title,
  children,
}: {
  fields: Field[];
  initial?: unknown;
  patch?: boolean;
  externallyDirty?: boolean;
  disabled?: boolean;
  onDirty: (dirty: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => Promise<boolean>;
  title: string;
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useDraftState(`${title}:fields`, () =>
    initialDraft(fields, initial),
  );
  const [touched, setTouched] = useDraftState(
    `${title}:touched`,
    () => new Set<string>(),
  );
  const [error, setError] = useState<string | null>(null);
  function change(key: string, value: unknown, touchKey = key) {
    setDraft((d) => ({ ...d, [key]: value }));
    setTouched((t) => new Set([...t, touchKey]));
    onDirty(true);
    setError(null);
  }
  async function save() {
    try {
      const payload = formPayload(fields, draft, patch ? touched : undefined);
      setError(null);
      if (await onSubmit(payload)) onDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    }
  }
  return (
    <View>
      <Text accessibilityRole="header" style={formStyles.rowTitle}>
        {title}
      </Text>
      <Text style={shellStyles.mutedText}>
        Shared household history. Blank optional facts clear to unknown; edits
        only change touched fields. No offline saves.
      </Text>
      {children}
      <NativeFields
        fields={fields}
        draft={draft}
        onChange={change}
        disabled={disabled}
      />
      {error ? <InlineNotice tone="error" message={error} /> : null}
      <View style={formStyles.inlineButtons}>
        <ActionButton
          label="Save changes"
          disabled={
            disabled || (patch && touched.size === 0 && !externallyDirty)
          }
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}
