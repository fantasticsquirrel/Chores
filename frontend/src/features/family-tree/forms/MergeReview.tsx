import { useTreeRefresh } from "../hooks/useTreeRefresh";
import { useTreeSavedReadback } from "../hooks/useTreeSavedReadback";
import { useExpiry } from "../hooks/useExpiry";
import { useRef, useState } from "react";
import { readFamilyTreeMergeSummary } from "@family-manager/family-api/models/family-tree-summary";
import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreePeoplePage,
  type FamilyTreePreview,
} from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { useTreeCommand, useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { useTreePages } from "../hooks/useTreeReads";
import { duplicateCandidates, previewIssue } from "../lib/workflows/advanced";
import { personName } from "../lib/workflows/workflows";
import { AdvancedFeedback, ConsequenceCounts } from "./AdvancedFeedback";
export function MergeReview({
  source,
  originRevision,
  people,
  onDirty,
  onSaved,
}: {
  source: FamilyTreePerson;
  originRevision: number;
  people: FamilyTreePerson[];
  onDirty: (value: boolean) => void;
  onSaved: () => void;
}) {
  const runtime = useTreeRuntime(),
    task = useTreeTask(),
    command = useTreeCommand();
  const baseline = useRef(originRevision);
  const refresh = useTreeRefresh();
  const readback = useTreeSavedReadback();
  const retryReceipt = command.hasAttempt && command.state.kind === "failure";
  const [targetId, setTargetId] = useState(""),
    [query, setQuery] = useState(""),
    [choices, setChoices] = useState<Record<string, "source" | "target">>({}),
    [retainPartners, setRetainPartners] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState<FamilyTreePreview | null>(null),
    [stamp, setStamp] = useState("");
  const directory = useTreePages<FamilyTreePerson, FamilyTreePeoplePage>(
    ["merge-directory", query],
    (cursor, options) =>
      apiClient.listFamilyTreePeople(
        { query, archived: false, cursor, limit: 40 },
        options,
      ),
  );
  const candidates = [
    ...new Map([...people, ...directory.items].map((p) => [p.id, p])).values(),
  ].filter(
    (p) =>
      p.id !== source.id &&
      !p.is_locked &&
      !p.archived_at &&
      !p.merged_into_person_id,
  );
  const selected = candidates.find((p) => p.id === Number(targetId));
  const summary = preview ? readFamilyTreeMergeSummary(preview) : null;
  const now = useExpiry(preview),
    fingerprint = JSON.stringify({ targetId, choices, retainPartners });
  const issue = preview
    ? previewIssue(preview, "merge", runtime.revision(), now) ||
      (!summary ||
      summary.source.id !== source.id ||
      summary.target.id !== Number(targetId)
        ? "The preview does not match the selected source and target. Request a fresh preview."
        : null)
    : null;
  const blocked =
    refresh.pending ||
    !runtime.manage ||
    !runtime.online ||
    runtime.busy ||
    runtime.checking ||
    !!readback.saved ||
    (!retryReceipt &&
      (source.is_locked ||
        !!source.archived_at ||
        !!source.merged_into_person_id));
  const ready =
    retryReceipt ||
    (!!preview &&
      !!summary &&
      !issue &&
      stamp === fingerprint &&
      !summary.unresolved_fields.length &&
      !summary.requires_partner_review);
  function change() {
    setConfirmed(false);
    onDirty(true);
  }
  async function requestPreview() {
    if (!selected || blocked) return;
    command.resetIntent();
    setConfirmed(false);
    const expected = baseline.current;
    const result = await task.run((options) =>
      apiClient.previewFamilyTreeMerge(
        {
          expected_graph_revision: expected,
          source_person_id: source.id,
          target_person_id: selected.id,
          scalar_choices: choices,
          retain_similar_partner_episodes: retainPartners,
        },
        options,
      ),
    );
    if (result) {
      setPreview(result);
      setStamp(fingerprint);
      onDirty(true);
    }
  }
  async function commit(reviewedChronology = false) {
    if (!ready || !confirmed || blocked || !preview || !summary) return;
    const result = reviewedChronology
      ? await command.reapply()
      : await command.submit(
          (intent, options) =>
            apiClient.commitFamilyTreeMerge(
              {
                ...intent,
                idempotency_key: intent.idempotency_key!,
                preview_token: preview.preview_token,
              },
              options,
            ),
          preview.expected_graph_revision,
        );
    if (!result) return;
    // The mutation envelope is not canonical-person data. Explicit exact readback.
    await readback.confirm(
      result,
      async (_receipt, options) => {
        const alias = await apiClient.getFamilyTreePerson(source.id, options);
        const canonical = await apiClient.getFamilyTreePerson(
          summary.target.id,
          options,
        );
        if (
          alias.person.merged_into_person_id !== canonical.person.id ||
          alias.canonical_person?.id !== canonical.person.id ||
          canonical.person.merged_into_person_id ||
          alias.graph_revision < result.committed_revision ||
          canonical.graph_revision < result.committed_revision
        )
          throw new Error(
            "Merge was saved, but alias/canonical readback could not be confirmed. Reload the records; do not start another merge.",
          );
        return true as const;
      },
      () => {
        onDirty(false);
        onSaved();
      },
      command,
    );
  }
  return (
    <section className="family-tree-record-form family-tree-advanced-form">
      <p>
        Duplicate suggestions are advisory only. No people or relationships are
        merged automatically. Source person {source.id} becomes an archived,
        noneditable alias of the canonical target; retained records keep their
        attribution.
      </p>
      <p>
        Advisory same-name candidates:{" "}
        {duplicateCandidates(source, candidates)
          .map((p) => `${personName(p)} (person ${p.id})`)
          .join(", ") ||
          "None in the loaded directory. You may still deliberately compare another person."}
      </p>
      <label>
        Search merge targets
        <input
          value={query}
          disabled={blocked || command.hasAttempt}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        Canonical target person
        <select
          value={targetId}
          disabled={blocked || command.hasAttempt}
          onChange={(e) => {
            setTargetId(e.target.value);
            setPreview(null);
            setChoices({});
            change();
          }}
        >
          <option value="">Choose a distinct unlocked canonical person</option>
          {candidates.map((p) => (
            <option value={p.id} key={p.id}>
              {personName(p)} (person {p.id})
            </option>
          ))}
        </select>
      </label>
      {directory.isPending ? <p>Loading merge candidates…</p> : null}
      {directory.error ? (
        <InlineNotice variant="error">
          Merge candidates unavailable.{" "}
          <Button onClick={() => void directory.refetch()}>
            Retry merge directory
          </Button>
        </InlineNotice>
      ) : null}
      {directory.hasNextPage ? (
        <Button onClick={() => void directory.fetchNextPage()}>
          Load more merge candidates
        </Button>
      ) : null}
      {summary ? (
        <>
          <h3>Complete merge preview</h3>
          <p>
            Source {summary.source.id} → canonical {summary.target.id}; revision{" "}
            {preview?.expected_graph_revision}.
          </p>
          <p>
            Choose every conflicting scalar, then request a new preview of those
            explicit choices.
          </p>
          {summary.conflicting_fields.map((field) => (
            <label key={field}>
              Retain {field}
              <p>
                Source:{" "}
                {JSON.stringify(
                  Object.entries(summary.source).find(
                    ([key]) => key === field,
                  )?.[1] ?? null,
                )}{" "}
                · Target:{" "}
                {JSON.stringify(
                  (summary.target &&
                    Object.entries(summary.target).find(
                      ([key]) => key === field,
                    )?.[1]) ??
                    null,
                )}
              </p>
              <select
                aria-label={`Retain ${field}`}
                value={choices[field] ?? ""}
                disabled={blocked || command.hasAttempt}
                onChange={(e) => {
                  setChoices({
                    ...choices,
                    [field]: e.target.value as "source" | "target",
                  });
                  change();
                }}
              >
                <option value="">Choose explicitly</option>
                <option value="source">Source value</option>
                <option value="target">Canonical target value</option>
              </select>
            </label>
          ))}
          <ConsequenceCounts counts={summary.retained_records} />
          <ul>
            {summary.relationship_changes.map((c) => (
              <li key={`${c.table}:${c.id}`}>
                {c.table} record {c.id} → people {c.endpoints.join(" / ")}
              </li>
            ))}
          </ul>
          <p>
            Retarget existing aliases:{" "}
            {summary.retargeted_alias_ids.join(", ") || "None"}.
          </p>
          {summary.similar_partner_episode_ids.length ? (
            <label>
              <input
                type="checkbox"
                checked={retainPartners}
                disabled={blocked || command.hasAttempt}
                onChange={(e) => {
                  setRetainPartners(e.target.checked);
                  change();
                }}
              />
              I reviewed similar partnership episodes{" "}
              {summary.similar_partner_episode_ids.join(", ")} and explicitly
              retain them.
            </label>
          ) : null}
          {summary.warnings.length ? (
            <p>{summary.warnings.join("; ")}</p>
          ) : null}
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
          baseline.current = runtime.revision();
          setPreview(null);
          setConfirmed(false);
          command.resetIntent();
        }}
      />
      <Button
        disabled={!selected || blocked}
        onClick={() => void requestPreview()}
      >
        Preview merge
      </Button>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!ready || blocked}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I reviewed the complete merge consequences.
      </label>
      <Button
        disabled={
          !ready ||
          !confirmed ||
          blocked ||
          command.state.kind === "conflict" ||
          command.state.kind === "chronology"
        }
        onClick={() => void commit()}
      >
        Commit reviewed merge
      </Button>
      {readback.saved ? (
        <>
          <p>
            Merge saved at revision {readback.saved.committed_revision}; retry
            only the protected alias/canonical readback.
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
            Retry saved merge readback
          </Button>
        </>
      ) : null}
      <p role="status">
        {task.pending
          ? "Loading revision-bound merge preview or exact alias/canonical readback…"
          : command.state.busy
            ? "Committing reviewed merge…"
            : ""}
      </p>
    </section>
  );
}
