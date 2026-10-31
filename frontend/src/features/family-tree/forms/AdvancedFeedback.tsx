import { Button, InlineNotice } from "../../../ui";
import type { useTreeCommand } from "../hooks/useTreeCommand";

export function AdvancedFeedback({
  error,
  command,
  onReload,
  onChronology,
  blocked = false,
  previewConflict = false,
}: {
  error: string | null;
  command?: ReturnType<typeof useTreeCommand>;
  onReload?: () => void | Promise<void>;
  onChronology?: () => Promise<void>;
  blocked?: boolean;
  previewConflict?: boolean;
}) {
  return (
    <>
      {error || command?.state.error ? (
        <InlineNotice variant="error">
          {error || command?.state.error}
        </InlineNotice>
      ) : null}
      {command?.state.kind === "conflict" || previewConflict ? (
        <section>
          <p>
            Your draft is retained. The records changed after this review.
            Reload and review the updated consequences before continuing.
          </p>
          <Button
            disabled={command?.state.busy || blocked}
            onClick={() => void onReload?.()}
          >
            Reload current records for a new preview
          </Button>
        </section>
      ) : null}
      {command?.state.kind === "chronology" && onChronology ? (
        <section>
          <p>
            Review the chronology warnings above before accepting uncertainty.
          </p>
          <label>
            <input
              type="checkbox"
              checked={command.state.reviewed}
              onChange={(e) => command.reviewChronology(e.target.checked)}
            />
            I reviewed the uncertain chronology warnings.
          </label>
          <Button
            disabled={!command.state.reviewed || command.state.busy || blocked}
            onClick={() => void onChronology?.()}
          >
            Confirm reviewed chronology
          </Button>
        </section>
      ) : null}
    </>
  );
}
export function ConsequenceCounts({
  counts,
}: {
  counts: Record<string, number>;
}) {
  return (
    <dl>
      {Object.entries(counts).map(([name, count]) => (
        <div key={name}>
          <dt>{name.replace(/_/g, " ")}</dt>
          <dd>{count}</dd>
        </div>
      ))}
    </dl>
  );
}
export function DraftClose({
  discard,
  onKeep,
  onDiscard,
}: {
  discard: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return discard ? (
    <section>
      <p>
        Discard this unsaved protected-session draft? Unattached staged files
        expire automatically; saved records are unchanged.
      </p>
      <Button onClick={onKeep}>Keep draft</Button>
      <Button onClick={onDiscard}>Discard advanced draft</Button>
    </section>
  ) : null;
}
