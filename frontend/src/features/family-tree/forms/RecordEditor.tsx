import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { FactField } from "./RecordFactField";

function readableReviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.length === 0
      ? "none"
      : `${value.length} ${value.length === 1 ? "record" : "records"}`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["display_name", "label", "title", "place", "name"])
      if (typeof record[key] === "string" && record[key])
        return String(record[key]);
    if (typeof record.year === "number")
      return [record.year, record.month, record.day]
        .filter((part) => part !== null && part !== undefined)
        .join("-");
    return "recorded details";
  }
  return String(value);
}

function readableReviewFacts(facts: Facts | undefined): string {
  if (!facts) return "none";
  const values = Object.values(facts)
    .map(readableReviewValue)
    .filter(
      (value, index, all) => value !== "none" && all.indexOf(value) === index,
    );
  return values.join(", ") || "none";
}

export function RecordEditor({
  fields,
  initial,
  originRevision,
  latest,
  reviewTarget,
  reviewFacts,
  create = false,
  operation,
  onSaved,
  onDirtyChange,
  confirmation,
  saveLabel = "Save changes",
}: {
  fields: Field[];
  initial: Facts;
  originRevision: number;
  latest?: Facts;
  reviewTarget?: ReviewTarget;
  reviewFacts?: Facts;
  create?: boolean;
  operation: (facts: Facts) => TreeOperation;
  onSaved: (result: FamilyTreeMutationResult) => void;
  onDirtyChange: (dirty: boolean, busy: boolean) => void;
  confirmation?: ReactNode;
  saveLabel?: string;
}) {
  const baseline = useRef(originRevision);
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
      command.state.reviewedRevision,
    );
  const frozen = command.hasAttempt || command.state.kind === "saved_readback";
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
  function complete(result: FamilyTreeMutationResult | null) {
    if (result && !command.savedReadbackPending()) onSaved(result);
  }
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

      const result = await command.submit(operation(facts), baseline.current);
      complete(result);
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
              {reviewFacts && (
                <p>
                  Original confirmed record: {readableReviewFacts(reviewFacts)};
                  latest record: {readableReviewFacts(currentFacts)}.
                </p>
              )}
              <dl>
                {[...touched].map((key) => (
                  <div key={key}>
                    <dt>
                      {fields.find((field) => field.key === key)?.label ?? key}
                    </dt>
                    <dd>
                      Original: {readableReviewValue(original.current[key])};
                      latest: {readableReviewValue(currentFacts?.[key])}; your
                      draft: {readableReviewValue(draft[key])}.
                    </dd>
                  </div>
                ))}
              </dl>
              <Button
                type="button"
                disabled={
                  !runtime.manage ||
                  !runtime.online ||
                  runtime.busy ||
                  (!!reviewTarget && !currentFacts)
                }
                onClick={() => void command.reapply().then(complete)}
              >
                Reapply reviewed draft
              </Button>
            </>
          )}
        </section>
      )}
      {command.state.kind === "chronology" && (
        <section aria-label="Chronology review">
          <p>
            Review the entered dates and the chronology warning. No approval is
            inferred from saving.
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
            onClick={() => void command.reapply().then(complete)}
          >
            Save after chronology review
          </Button>
        </section>
      )}
      {command.state.kind === "saved_readback" && (
        <section aria-label="Saved readback recovery">
          <p>
            The change was saved. Retry only loading the saved tree; do not
            submit another change.
          </p>
          <Button
            type="button"
            disabled={
              !runtime.manage ||
              !runtime.online ||
              runtime.busy ||
              runtime.checking
            }
            onClick={() => void command.retrySavedReadback(true).then(complete)}
          >
            Retry saved readback
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
