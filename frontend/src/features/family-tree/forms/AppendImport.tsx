import { useTreeRefresh } from "../hooks/useTreeRefresh";
import { useTreeSavedReadback } from "../hooks/useTreeSavedReadback";
import { useExpiry } from "../hooks/useExpiry";
import { useEffect, useState } from "react";
import { readFamilyTreeImportSummary } from "@family-manager/family-api/models/family-tree-summary";
import { apiClient, ApiClientError, type FamilyTreeJob } from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { useTreeRuntime, useTreeCommand } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { jobIssue, fileIssue } from "../lib/workflows/advanced";
import { AdvancedFeedback, ConsequenceCounts } from "./AdvancedFeedback";
export function AppendImport({
  onDirty,
  registerDiscard,
}: {
  onDirty: (dirty: boolean) => void;
  registerDiscard: (cancel: (() => Promise<boolean>) | null) => void;
}) {
  const runtime = useTreeRuntime(),
    task = useTreeTask(),
    command = useTreeCommand();
  const refresh = useTreeRefresh();
  const readback = useTreeSavedReadback();
  const [file, setFile] = useState<File | null>(null),
    [job, setJob] = useState<FamilyTreeJob | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [acknowledge, setAcknowledge] = useState(false),
    [message, setMessage] = useState("");
  const [fileEpoch, setFileEpoch] = useState(0);
  const [readbackConfirmed, setReadbackConfirmed] = useState(false);
  const retryReceipt = command.hasAttempt && command.state.kind === "failure";
  const now = useExpiry(job),
    summary = job ? readFamilyTreeImportSummary(job) : null;
  const blocked =
    !!readback.saved ||
    refresh.pending ||
    !runtime.manage ||
    !runtime.online ||
    runtime.busy ||
    runtime.checking;
  const issue = job
    ? jobIssue(job, "import", runtime.revision(), now) ||
      (!summary
        ? "The import summary is incomplete. Cancel and stage a supported logical package again."
        : null)
    : null;
  async function stage() {
    if (blocked || !file || job) return;
    const problem = fileIssue(file, "import");
    if (problem) {
      task.setError(problem);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("expected_graph_revision", String(runtime.revision()));
    setMessage("");
    setReadbackConfirmed(false);
    const staged = await task.run((options) =>
      apiClient.stageFamilyTreeImport(body, options),
    );
    if (!staged) return;
    // Preserve the exact staged ID even if its readback fails, so cancellation is real.
    setJob(staged);
    onDirty(true);
    await refreshPreview(staged);
  }
  async function refreshPreview(staged = job) {
    if (!staged || blocked) return;
    setReadbackConfirmed(false);
    const readback = await task.run((options) =>
      apiClient.getFamilyTreeImportJob(staged.id, options),
    );
    if (!readback) return;
    const problem = jobIssue(
      readback,
      "import",
      staged.expected_graph_revision,
    );
    if (
      readback.id !== staged.id ||
      problem ||
      !readFamilyTreeImportSummary(readback)
    ) {
      task.setError(
        problem ||
          "Import readback did not match the staged job. Cancel this staging; do not commit.",
      );
      return;
    }
    setJob(readback);
    setReadbackConfirmed(true);
  }
  async function cancel(): Promise<boolean> {
    if (blocked) return false;
    if (!job) {
      setFile(null);
      setFileEpoch((value) => value + 1);
      onDirty(false);
      return true;
    }
    const cancelled = await task.run(async (options) => {
      let wasCanceled = false;
      try {
        const value = await apiClient.cancelFamilyTreeImport(job.id, options);
        if (
          value.id !== job.id ||
          value.kind !== "import" ||
          value.state !== "canceled"
        )
          throw new Error(
            "Cancellation was not confirmed for this import. Retry explicitly.",
          );
        wasCanceled = true;
      } catch (error) {
        if (
          !(
            error instanceof ApiClientError && error.code === "transfer_expired"
          )
        )
          throw error;
      }
      try {
        const current = await apiClient.getFamilyTreeImportJob(job.id, options);
        if (current.state === "committed")
          throw new Error(
            "This import was already committed and cannot be canceled. Retry its exact receipt/readback, not another upload.",
          );
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.code === "transfer_expired"
        )
          return wasCanceled ? "canceled" : "unavailable";
        throw error;
      }
      throw new Error(
        "Import staging is still active after cancellation. Retry explicitly; do not commit.",
      );
    });
    if (cancelled) {
      setJob(null);
      setFile(null);
      setFileEpoch((value) => value + 1);
      setConfirmed(false);
      setAcknowledge(false);
      command.resetIntent();
      onDirty(false);
      setMessage(
        cancelled === "canceled"
          ? "Staged import cancelled; exact job readback is no longer available. Existing tree records are unchanged."
          : "Staged import expired or unavailable; exact job readback confirmed. The local staging draft is cleared; existing records are unchanged.",
      );
      return true;
    }
    return false;
  }
  useEffect(() => {
    registerDiscard(() => cancel());
    return () => registerDiscard(null);
  });
  async function commit(reviewedChronology = false) {
    if (
      blocked ||
      !job ||
      !summary ||
      (!retryReceipt && (issue || !readbackConfirmed)) ||
      !confirmed ||
      (summary.duplicate_provenance && !acknowledge)
    )
      return;
    if (!retryReceipt && !reviewedChronology) {
      const checked = await task.run((options) =>
        apiClient.getFamilyTreeImportJob(job.id, options),
      );
      if (!checked) return;
      const problem = jobIssue(checked, "import", runtime.revision());
      if (
        checked.id !== job.id ||
        problem ||
        !readFamilyTreeImportSummary(checked)
      ) {
        task.setError(problem || "Mismatched import job readback.");
        return;
      }
    }
    const result = reviewedChronology
      ? await command.reapply()
      : await command.submit(
          (intent, options) =>
            apiClient.commitFamilyTreeImport(
              job.id,
              {
                ...intent,
                idempotency_key: intent.idempotency_key!,
                confirmed: true,
                acknowledge_duplicate_provenance: acknowledge,
              },
              options,
            ),
          job.expected_graph_revision,
        );
    if (!result) return;
    await readback.confirm(
      result,
      async (_receipt, options) => {
        const checked = await apiClient.getFamilyTreeImportJob(job.id, options);
        if (
          checked.id !== job.id ||
          checked.kind !== "import" ||
          checked.state !== "committed" ||
          checked.expected_graph_revision !== job.expected_graph_revision
        )
          throw new Error(
            "Saved, but committed import job readback is not confirmed. Retry this exact job read; do not upload the package again.",
          );
        return true as const;
      },
      () => {
        onDirty(false);
        setJob(null);
        setFile(null);
        setFileEpoch((value) => value + 1);
        setConfirmed(false);
        setAcknowledge(false);
        command.resetIntent();
        setMessage(
          `Import committed and read back at revision ${result.current_revision}. Fresh local IDs and provenance were retained; no identities were automatically linked.`,
        );
      },
      command,
    );
  }
  return (
    <section
      className="family-tree-record-form family-tree-advanced-form"
      aria-label="Append import"
    >
      <h3>Append logical import</h3>
      <p>
        Upload a versioned logical JSON or ZIP (at most 100 MiB). Append creates
        fresh local IDs. It never replaces the database, reconnects accounts,
        loads remote media or modifies other modules.
      </p>
      <label>
        Append import file
        <input
          key={fileEpoch}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          disabled={blocked || !!job || command.hasAttempt}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            onDirty(!!e.target.files?.length);
          }}
        />
      </label>
      <Button disabled={blocked || !file || !!job} onClick={() => void stage()}>
        Stage append import
      </Button>
      {summary ? (
        <>
          <h4>Complete append preview</h4>
          <ConsequenceCounts
            counts={{
              people: summary.people,
              relationships: summary.relationships,
              stories: summary.stories,
              residences: summary.residences,
              media: summary.media,
            }}
          />
          <p>Missing media: {summary.missing_media}</p>
          <p>Warnings: {summary.warnings.join("; ") || "None"}</p>
          <p>
            Unsupported fields:{" "}
            {summary.unsupported_fields.join(", ") || "None"}
          </p>
          <ul>
            {summary.duplicate_suggestions.map((s) => (
              <li key={s.source_key}>
                Advisory duplicate source {s.source_key}: person IDs{" "}
                {s.candidate_person_ids.join(", ")}
              </li>
            ))}
          </ul>
          <p>
            Job {job?.id} · Preview revision {job?.expected_graph_revision} ·
            Expires {job?.expires_at}
          </p>
        </>
      ) : null}
      {job && !readbackConfirmed ? (
        <>
          <p>
            Staging has not yet been confirmed by an exact authorized job
            readback.
          </p>
          <Button disabled={!!blocked} onClick={() => void refreshPreview()}>
            Refresh staged import preview
          </Button>
        </>
      ) : null}
      {issue ? <InlineNotice variant="error">{issue}</InlineNotice> : null}
      <AdvancedFeedback
        error={readback.error || refresh.error || task.error}
        previewConflict={task.code === "revision_conflict"}
        command={command}
        blocked={!!blocked}
        onChronology={() => commit(true)}
        onReload={async () => {
          if (
            !(command.state.kind === "conflict"
              ? await command.reviewLatest()
              : await refresh.reload())
          )
            return;
          setConfirmed(false);
          setAcknowledge(false);
          command.resetIntent();
          task.setError(
            "The staged job is bound to the old revision. Cancel it, then explicitly stage the retained file against current records.",
          );
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={blocked || !!issue || !summary}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I reviewed counts, missing media, warnings and append-only consequences.
      </label>
      {summary?.duplicate_provenance ? (
        <label>
          <input
            type="checkbox"
            checked={acknowledge}
            disabled={blocked || !!issue}
            onChange={(e) => setAcknowledge(e.target.checked)}
          />
          I reviewed prior package provenance and accept possible duplicates.
        </label>
      ) : null}
      <Button
        disabled={
          blocked ||
          (!retryReceipt && (!!issue || !readbackConfirmed)) ||
          !summary ||
          !confirmed ||
          (summary.duplicate_provenance && !acknowledge) ||
          command.state.kind === "conflict" ||
          command.state.kind === "chronology"
        }
        onClick={() => void commit()}
      >
        Commit append import
      </Button>
      {job ? (
        <Button disabled={blocked} onClick={() => void cancel()}>
          Cancel staged import
        </Button>
      ) : null}
      {readback.saved ? (
        <>
          <p>
            Import saved at revision {readback.saved.committed_revision}; retry
            only the committed-job read.
          </p>
          <Button
            disabled={
              !runtime.manage ||
              !runtime.online ||
              runtime.busy ||
              runtime.checking
            }
            onClick={() => void readback.retry()}
          >
            Retry saved import readback
          </Button>
        </>
      ) : null}
      <p role="status">
        {task.pending
          ? "Validating private append staging or reading the exact job…"
          : command.state.busy
            ? "Committing reviewed append import…"
            : message}
      </p>
    </section>
  );
}
