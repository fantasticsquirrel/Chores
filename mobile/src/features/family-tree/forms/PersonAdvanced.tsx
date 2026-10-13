import { shellStyles } from "../../../styles/shell";
import { useState } from "react";
import { Text, View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
import type { TreeTools } from "../hooks/useTreeTools";
import { MediaTools } from "./MediaTools";
import { MergeTools } from "./MergeTools";
import { PurgeTools } from "./PurgeTools";
export function PersonAdvanced({
  tools,
  state,
  core,
  onDirty,
  requestDiscard,
}: {
  tools: TreeTools;
  state: TreeState;
  core: TreeWorkflow;
  onDirty: (v: boolean) => void;
  requestDiscard: (f: () => void) => void;
}) {
  const [panel, setPanel] = useState<"media" | "merge" | "purge" | null>(null);
  // The screen-scoped runtime owns retirement. Discovery hiding is not discard.
  const recoveryPanel = tools.media.pending
    ? "media"
    : tools.decisions.pendingMerge
      ? "merge"
      : tools.decisions.pendingPurge
        ? "purge"
        : null;
  const visiblePanel = recoveryPanel ?? panel;
  if (recoveryPanel && tools.runtime.recoveryDetail)
    state = { ...state, detail: tools.runtime.recoveryDetail };
  if (!["view", "manage"].includes(state.access) || !state.detail) return null;
  const manager =
    state.access === "manage" &&
    state.collection?.capabilities.can_manage === true;
  function open(next: typeof panel) {
    requestDiscard(() => {
      tools.media.clear();
      tools.decisions.clear();
      setPanel(next);
      if (next === "media")
        void tools.media
          .load(state.detail!.person.id)
          .catch((e) => tools.runtime.fail(e));
    });
  }
  return (
    <View>
      {recoveryPanel ? (
        <Text style={shellStyles.mutedText}>
          Original command review only; these retained facts are not a fresh
          snapshot. Retry sends the original revision and command key.
        </Text>
      ) : null}
      {visiblePanel === "media" ? (
        <Text accessibilityRole="header">Photographs</Text>
      ) : null}
      {!visiblePanel ? (
        <>
          <ActionButton
            label="Photographs"
            disabled={state.busy || state.loading}
            onPress={() => open("media")}
          />
          {manager ? (
            <ActionButton
              label="Duplicate / merge"
              disabled={state.busy || state.loading || !!state.pending}
              onPress={() => open("merge")}
            />
          ) : null}
          {manager && state.collection?.capabilities.can_purge === true ? (
            <ActionButton
              label="Permanent purge"
              variant="danger"
              disabled={state.busy || state.loading || !!state.pending}
              onPress={() => open("purge")}
            />
          ) : null}
        </>
      ) : null}
      {tools.runtime.working ? (
        <>
          <Text style={shellStyles.mutedText}>
            Working on family history. Abort is not rollback; retry only the
            original pending intent.
          </Text>
          <ActionButton
            label="Interrupt advanced Family Tree request"
            onPress={() => tools.runtime.interrupt()}
          />
        </>
      ) : null}
      {tools.runtime.error ? (
        <Text style={shellStyles.mutedText} accessibilityRole="alert">
          {tools.runtime.error}
        </Text>
      ) : null}
      {visiblePanel === "media" ? (
        <MediaTools tools={tools} state={state} onDirty={onDirty} />
      ) : null}
      {visiblePanel === "merge" ? (
        <MergeTools tools={tools} state={state} core={core} onDirty={onDirty} />
      ) : null}
      {visiblePanel === "purge" ? (
        <PurgeTools
          key={`purge:${state.collection?.capabilities.can_purge}`}
          tools={tools}
          state={state}
          onDirty={onDirty}
        />
      ) : null}
      {visiblePanel ? (
        <ActionButton
          label="Back from advanced person tools"
          disabled={state.busy}
          onPress={() => open(null)}
        />
      ) : null}
    </View>
  );
}
