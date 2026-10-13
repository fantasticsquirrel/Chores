import { useTreeRefresh } from "../hooks/useTreeRefresh";
import { useTreeSavedReadback } from "../hooks/useTreeSavedReadback";
import { useExpiry } from "../hooks/useExpiry";
import { useState } from "react";
import { readFamilyTreePurgeSummary } from "@family-manager/family-api/models/family-tree-summary";
import {
  apiClient,
  ApiClientError,
  type FamilyTreePerson,
  type FamilyTreePreview,
} from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { useTreeCommand, useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { previewIssue } from "../lib/workflows/advanced";
import { AdvancedFeedback, ConsequenceCounts } from "./AdvancedFeedback";
export function PurgeReview({
  person,
  canPurge,
  onDirty,
  onSaved,
}: {
  person: FamilyTreePerson;
  canPurge: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const runtime = useTreeRuntime(),
    task = useTreeTask(),
    command = useTreeCommand();
  const refresh = useTreeRefresh();
  const readback = useTreeSavedReadback();
  const retryReceipt = command.hasAttempt && command.state.kind === "failure";
  const [password, setPassword] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState<FamilyTreePreview | null>(null);
  const summary = preview ? readFamilyTreePurgeSummary(preview) : null,
    now = useExpiry(preview);
  const issue = preview
    ? previewIssue(preview, "purge", runtime.revision(), now) ||
      (!summary ||
      summary.person_id !== person.id ||
      summary.alias_only !== !!person.merged_into_person_id
        ? "The purge preview does not match this selected person. Request a fresh preview."
        : null)
    : null;
  const blocked =
    !canPurge ||
    refresh.pending ||
    !runtime.manage ||
    !runtime.online ||
    runtime.busy ||
    runtime.checking ||
    !!readback.saved ||
    (!retryReceipt && person.is_locked);
  async function requestPreview() {
    if (blocked || !password) return;
    command.resetIntent();
    setConfirmed(false);
    setPreview(null);
    try {
      const result = await task.run((options) =>
        apiClient.previewFamilyTreePurge(
          person.id,
          { expected_graph_revision: runtime.revision(), password },
          options,
        ),
      );
      if (result) {
        setPreview(result);
        onDirty(true);
      }
    } finally {
      setPassword("");
    }
  }
  async function commit() {
    if (blocked || !confirmed || !password || !preview || !summary || issue)
      return;
    const entered = password;
    try {
      const result = await command.submit((intent, options) =>
        apiClient.commitFamilyTreePurge(
          person.id,
          {
            ...intent,
            idempotency_key: intent.idempotency_key!,
            preview_token: preview.preview_token,
            password: entered,
          },
          options,
        ),
      );
      if (!result) return;
      await readback.confirm(
        result,
        async (_receipt, options) => {
          try {
            await apiClient.getFamilyTreePerson(person.id, options);
          } catch (error) {
            if (error instanceof ApiClientError && error.status === 404) {
              if (person.merged_into_person_id) {
                const canonical = await apiClient.getFamilyTreePerson(
                  person.merged_into_person_id,
                  options,
                );
                if (
                  canonical.person.id !== person.merged_into_person_id ||
                  canonical.graph_revision < result.committed_revision
                )
                  throw new Error(
                    "Alias was purged, but canonical retention readback is not current. Reload.",
                  );
              }
              return true as const;
            }
            throw error;
          }
          throw new Error(
            "Purge was saved but the person still appears in the readback. Reload; do not purge another person.",
          );
        },
        () => {
          onDirty(false);
          onSaved(
            "Purge confirmed by an authorized not-found readback; other people and retained snapshots were not purged.",
          );
        },
      );
    } finally {
      setPassword("");
    }
  }
  return (
    <section className="family-tree-record-form family-tree-advanced-form">
      <p>
        Permanent purge is irreversible in the current tree. Only the household
        owner with current Family Tree manage authority may preview and confirm
        it. Role labels do not grant ownership. Locked people must be explicitly
        unlocked first.
      </p>
      {person.merged_into_person_id ? (
        <p>
          This is alias-only removal. Canonical person{" "}
          {person.merged_into_person_id} and all moved facts are retained.
        </p>
      ) : (
        <p>
          Canonical purge is blocked while aliases point here. Purge each
          blocking alias explicitly, then obtain a new target preview.
        </p>
      )}
      <label>
        Owner password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={blocked}
          onChange={(e) => {
            setPassword(e.target.value);
            onDirty(!!e.target.value || !!preview);
          }}
        />
      </label>
      <Button
        disabled={blocked || !password}
        onClick={() => void requestPreview()}
      >
        Preview permanent purge
      </Button>
      {summary ? (
        <>
          <h3>Permanent removal of person {summary.person_id}</h3>
          <ConsequenceCounts
            counts={{
              stories: summary.stories,
              residences: summary.residences,
              media_references: summary.media_references,
            }}
          />
          <p>{summary.retained_backup_policy}</p>
          <p>
            Password was cleared after preview. Enter it again for final
            confirmation.
          </p>
        </>
      ) : null}
      {issue ? <InlineNotice variant="error">{issue}</InlineNotice> : null}
      <AdvancedFeedback
        error={readback.error || refresh.error || task.error}
        previewConflict={task.code === "revision_conflict"}
        command={command}
        onReload={async () => {
          if (
            !(command.state.kind === "conflict"
              ? await command.reviewLatest()
              : await refresh.reload())
          )
            return;
          setPreview(null);
          setConfirmed(false);
          setPassword("");
          command.resetIntent();
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={blocked || !summary || !!issue}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I understand this removes only this person irreversibly.
      </label>
      <Button
        disabled={
          blocked ||
          !password ||
          !summary ||
          (!retryReceipt && !!issue) ||
          !confirmed ||
          command.state.kind === "conflict"
        }
        onClick={() => void commit()}
      >
        Commit permanent purge
      </Button>
      {readback.saved ? (
        <>
          <p>
            Purge saved at revision {readback.saved.committed_revision}; do not
            submit another purge to repair readback.
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
            Retry saved purge readback
          </Button>
        </>
      ) : null}
      <p role="status">
        {task.pending
          ? "Checking owner-authorized purge preview or readback…"
          : command.state.busy
            ? "Committing permanent purge…"
            : ""}
      </p>
    </section>
  );
}
