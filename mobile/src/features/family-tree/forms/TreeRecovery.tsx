import { ActivityIndicator, Text, View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { InlineNotice } from "../../../components/InlineNotice";
import { shellStyles } from "../../../styles/shell";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
import { RevisionReview } from "./RevisionReview";
export function TreeRecovery({
  state,
  workflow,
  requestDiscard,
  setDirty,
}: {
  state: TreeState;
  workflow: TreeWorkflow;
  requestDiscard: (action: () => void) => void;
  setDirty: (dirty: boolean) => void;
}) {
  const allowed = state.access === "view" || state.access === "manage";
  return (
    <>
      {state.loading ? (
        <View>
          <ActivityIndicator />
          <Text accessibilityLiveRegion="polite" style={shellStyles.mutedText}>
            Loading family history…
          </Text>
        </View>
      ) : null}
      {state.lastCommit && state.readbackPending && state.error && allowed ? (
        <InlineNotice
          tone="warning"
          message="Save confirmed, but refreshed records could not be loaded. Refresh will not repeat the change."
        />
      ) : null}
      {state.error ? (
        <>
          <InlineNotice tone="error" message={state.error} />
          <ActionButton
            label={allowed ? "Refresh Family Tree" : "Retry Family Tree"}
            disabled={state.busy || state.loading}
            variant="secondary"
            onPress={() => void workflow.refresh()}
          />
        </>
      ) : null}
      {state.mutationError ? (
        <InlineNotice tone="error" message={state.mutationError} />
      ) : null}
      {state.pending && allowed ? (
        <SectionCard title="Draft retained">
          <Text style={shellStyles.mutedText}>
            Your pending change is retained. Review or retry it; editing the
            form does not replace it.
          </Text>
          {state.pending.code === "revision_conflict" ? (
            <>
              <Text style={shellStyles.mutedText}>
                Another manager changed this tree. Your draft is preserved. Load
                the latest facts and explicitly reapply only after review.
              </Text>
              <ActionButton
                label="Review latest records"
                disabled={state.busy || state.loading}
                variant="secondary"
                onPress={() => void workflow.reviewConflict()}
              />
              {state.pending.latestReviewed ? (
                <>
                  <RevisionReview state={state} />
                  <Text style={shellStyles.mutedText}>
                    Review the refreshed person facts below against your draft.
                  </Text>
                  <ActionButton
                    label="Reapply reviewed draft"
                    disabled={state.busy || state.loading}
                    onPress={() => void workflow.reapply()}
                  />
                </>
              ) : null}
            </>
          ) : state.pending.code === "chronology_review" ? (
            <>
              <Text style={shellStyles.mutedText}>
                Chronology may be unusual. Confirm that you reviewed the dates
                and wish to preserve them.
              </Text>
              <ActionButton
                label="Confirm chronology and save"
                disabled={state.busy || state.loading}
                onPress={() => void workflow.confirmChronology()}
              />
            </>
          ) : (
            <ActionButton
              label="Retry pending change"
              disabled={state.busy || state.loading}
              onPress={() => void workflow.retryMutation()}
            />
          )}
          <ActionButton
            label="Discard pending change"
            disabled={state.busy}
            variant="secondary"
            onPress={() =>
              requestDiscard(() => {
                workflow.discardPending();
                setDirty(false);
              })
            }
          />
        </SectionCard>
      ) : null}
      {state.busy ? (
        <Text accessibilityLiveRegion="polite" style={shellStyles.mutedText}>
          Saving shared history…
        </Text>
      ) : null}
    </>
  );
}
