import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  parsePartialDate,
  type DateInput,
} from "@family-manager/family-tree-core";
import { Button, InlineNotice } from "../../../ui";
import { fieldChanges, type Facts } from "../lib/workflows/workflows";
import {
  useTreeCommand,
  useTreeRuntime,
  type TreeOperation,
} from "../hooks/useTreeCommand";
import type { FamilyTreeMutationResult } from "../../../api";
import { useQueryClient } from "@tanstack/react-query";
import { latestFacts, type ReviewTarget } from "../lib/workflows/review";

import type { Field } from "../lib/workflows/fields";

function FactField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const id = useId();
  if (field.type === "date") {
    const date = value as
      | { value: string; uncertain?: boolean }
      | null
      | undefined;
    return (
      <fieldset disabled={disabled}>
        <legend>{field.label}</legend>
        <label htmlFor={id}>{field.label} (YYYY, YYYY-MM, or YYYY-MM-DD)</label>
        <input
          id={id}
          value={date?.value ?? ""}
          pattern="[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?"
          onChange={(event) =>
            onChange(
              event.target.value
                ? {
                    value: event.target.value,
                    uncertain: date?.uncertain ?? false,
                  }
                : null,
            )
          }
        />
        <label>
          <input
            type="checkbox"
            checked={date?.uncertain ?? false}
            disabled={!date?.value}
            onChange={(event) =>
              onChange({ ...date, uncertain: event.target.checked })
            }
          />{" "}
          {field.label} uncertain
        </label>
        <small>Blank means unknown; no day is invented.</small>
      </fieldset>
    );
  }
  if (field.type === "aliases") {
    const aliases = (value ?? []) as { name: string; label: string | null }[];
    return (
      <fieldset disabled={disabled}>
        <legend>{field.label}</legend>
        {aliases.map((alias, index) => (
          <div key={index}>
            <label>
              Alias {index + 1} name
              <input
                value={alias.name}
                required
                onChange={(event) =>
                  onChange(
                    aliases.map((item, i) =>
                      i === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Alias {index + 1} label
              <input
                value={alias.label ?? ""}
                onChange={(event) =>
                  onChange(
                    aliases.map((item, i) =>
                      i === index
                        ? { ...item, label: event.target.value || null }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <Button
              type="button"
              onClick={() => onChange(aliases.filter((_, i) => i !== index))}
            >
              Remove alias {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          onClick={() => onChange([...aliases, { name: "", label: null }])}
        >
          Add alias
        </Button>
      </fieldset>
    );
  }
  if (field.type === "boolean")
    return (
      <label>
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />{" "}
        {field.label}
      </label>
    );
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {field.label}
        {field.required ? " (required)" : ""}
      </label>
      {field.type === "select" ? (
        <select
          id={id}
          value={String(value ?? field.options?.[0] ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      ) : field.type === "person" ? (
        <select
          id={id}
          required
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="">Choose a recorded person</option>
          {field.choices?.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          required={field.required}
          rows={5}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : (
        <input
          id={id}
          required={field.required}
          value={
            field.type === "tags"
              ? ((value as string[] | undefined)?.join(", ") ?? "")
              : String(value ?? "")
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              field.type === "tags"
                ? event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : event.target.value || null,
            )
          }
        />
      )}
    </div>
  );
}

export function RecordEditor({
  fields,
  initial,
  latest,
  reviewTarget,
  create = false,
  operation,
  onSaved,
  onDirtyChange,
  confirmation,
  saveLabel = "Save changes",
}: {
  fields: Field[];
  initial: Facts;
  latest?: Facts;
  reviewTarget?: ReviewTarget;
  create?: boolean;
  operation: (facts: Facts) => TreeOperation;
  onSaved: (result: FamilyTreeMutationResult) => void;
  onDirtyChange: (dirty: boolean, busy: boolean) => void;
  confirmation?: ReactNode;
  saveLabel?: string;
}) {
  const original = useRef(initial),
    [draft, setDraft] = useState(initial),
    [touched, setTouched] = useState<Set<string>>(new Set()),
    [validation, setValidation] = useState<string | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const command = useTreeCommand(),
    runtime = useTreeRuntime();
  const client = useQueryClient();
  const currentFacts =
    latest ??
    latestFacts(
      reviewTarget,
      client.getQueriesData({ queryKey: ["family-tree", runtime.owner] }),
    );
  const frozen = command.hasAttempt;
  useEffect(() => {
    onDirtyChange(touched.size > 0 || command.hasAttempt, command.state.busy);
  }, [touched, command.hasAttempt, command.state.busy, onDirtyChange]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (touched.size || command.hasAttempt) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [touched, command.hasAttempt]);
  async function save() {
    setValidation(null);
    try {
      const normalized = { ...draft };
      for (const field of fields)
        if (
          field.type === "date" &&
          normalized[field.key] &&
          (create || touched.has(field.key))
        )
          normalized[field.key] = parsePartialDate(
            normalized[field.key] as DateInput,
          );
      const facts = create
        ? normalized
        : fieldChanges(original.current, normalized, touched);
      if (fields.length && !create && !Object.keys(facts).length) {
        setValidation("Change a fact before saving.");
        return;
      }

      const result = await command.submit(operation(facts));
      if (result) onSaved(result);
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check the entered facts.",
      );
    }
  }
  return (
    <form
      className="family-tree-record-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {confirmation && (
        <>
          <div>{confirmation}</div>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={command.state.busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            I confirm this specific change.
          </label>
        </>
      )}
      <fieldset
        disabled={!runtime.manage || !runtime.online || runtime.busy || frozen}
      >
        {fields.map((field) => (
          <FactField
            key={field.key}
            field={field}
            value={draft[field.key]}
            disabled={false}
            onChange={(value) => {
              setDraft((current) => ({ ...current, [field.key]: value }));
              setTouched((current) => new Set([...current, field.key]));
            }}
          />
        ))}
      </fieldset>
      {validation && <InlineNotice variant="error">{validation}</InlineNotice>}
      {command.state.error && (
        <InlineNotice variant="error">
          {command.state.error} Your draft is still here.
        </InlineNotice>
      )}
      {command.state.kind === "conflict" && (
        <section aria-label="Conflict review">
          <p>
            The tree changed. Nothing was automatically retried. Review the
            latest records before deliberately reapplying these changes.
          </p>
          <Button
            type="button"
            disabled={
              command.state.busy ||
              !runtime.online ||
              !runtime.manage ||
              runtime.busy
            }
            onClick={() => void command.reviewLatest()}
          >
            Review latest records
          </Button>
          {command.state.reviewed && (
            <>
              <dl>
                {[...touched].map((key) => (
                  <div key={key}>
                    <dt>
                      {fields.find((field) => field.key === key)?.label ?? key}
                    </dt>
                    <dd>
                      Original: {JSON.stringify(original.current[key] ?? null)};
                      latest: {JSON.stringify(currentFacts?.[key] ?? null)};
                      your draft: {JSON.stringify(draft[key] ?? null)}
                    </dd>
                  </div>
                ))}
              </dl>
              <Button
                type="button"
                disabled={!runtime.manage || !runtime.online || runtime.busy}
                onClick={() =>
                  void command.reapply().then((result) => {
                    if (result) onSaved(result);
                  })
                }
              >
                Reapply reviewed draft at revision {runtime.revision()}
              </Button>
            </>
          )}
        </section>
      )}
      {command.state.kind === "chronology" && (
        <section aria-label="Chronology review">
          <p>
            Review the entered dates and the server&apos;s chronology warning.
            No approval is inferred from saving.
          </p>
          <label>
            <input
              type="checkbox"
              checked={command.state.reviewed}
              onChange={(event) => {
                command.reviewChronology(event.target.checked);
              }}
            />{" "}
            I deliberately reviewed the chronology warning.
          </label>
          <Button
            type="button"
            disabled={
              !command.state.reviewed ||
              !runtime.manage ||
              !runtime.online ||
              runtime.busy
            }
            onClick={() =>
              void command.reapply().then((result) => {
                if (result) onSaved(result);
              })
            }
          >
            Save after chronology review
          </Button>
        </section>
      )}
      {(!command.state.kind || command.state.kind === "failure") && (
        <Button
          type="submit"
          disabled={
            !runtime.manage ||
            !runtime.online ||
            runtime.busy ||
            (!!confirmation && !confirmed)
          }
        >
          {command.state.busy
            ? "Saving…"
            : command.state.kind === "failure" && command.hasAttempt
              ? "Retry same request"
              : saveLabel}
        </Button>
      )}
      {!runtime.online && (
        <p role="status">
          Offline. Draft is kept in memory; saving is unavailable.
        </p>
      )}
    </form>
  );
}
