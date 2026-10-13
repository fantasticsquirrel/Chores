import { useEffect, useMemo, useSyncExternalStore } from "react";
import { apiClient } from "../../../api/client";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
import * as nativeFiles from "../lib/advanced/nativeFiles";
import { ToolRuntime } from "../lib/advanced/runtime";
import { MediaWorkflow } from "../lib/advanced/mediaWorkflow";
import { MergePurgeWorkflow } from "../lib/advanced/mergePurgeWorkflow";
import { TransferWorkflow } from "../lib/advanced/transferWorkflow";
export function useTreeTools(core: TreeWorkflow, state: TreeState) {
  const tools = useMemo(() => {
    const runtime = new ToolRuntime(apiClient, core, nativeFiles);
    return {
      runtime,
      media: new MediaWorkflow(runtime),
      decisions: new MergePurgeWorkflow(runtime),
      transfer: new TransferWorkflow(runtime),
    };
  }, [core, state.draftEpoch]);
  useSyncExternalStore(
    tools.runtime.subscribe,
    tools.runtime.snapshot,
    tools.runtime.snapshot,
  );
  useEffect(
    () => () => {
      tools.runtime.reset();
      tools.media.clear();
      tools.decisions.clear();
      tools.transfer.clear();
    },
    [tools],
  );
  return tools;
}
export type TreeTools = ReturnType<typeof useTreeTools>;
