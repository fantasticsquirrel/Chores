import { useRef, useState } from "react";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import type { FamilyTreeMutationResult } from "../../../api";
import { useTreeTask } from "./useTreeTask";
import type { useTreeCommand } from "./useTreeCommand";

type SavedCheck = {
  result: FamilyTreeMutationResult;
  load: (
    result: FamilyTreeMutationResult,
    options: RequestOptions,
  ) => Promise<true>;
  onVerified: () => void;
  command?: ReturnType<typeof useTreeCommand>;
};
/** A known saved command is never resubmitted just to repair its GET readback. */
export function useTreeSavedReadback() {
  const task = useTreeTask();
  const check = useRef<SavedCheck | null>(null);
  const [saved, setSaved] = useState<FamilyTreeMutationResult | null>(null);
  async function retry() {
    const current = check.current;
    if (!current) return;
    if (
      current.command?.savedReadbackPending() &&
      !(await current.command.retrySavedReadback())
    )
      return;
    const verified = await task.run((options) =>
      current.load(current.result, options),
    );
    if (verified === true) {
      check.current = null;
      setSaved(null);
      current.onVerified();
    }
  }
  async function confirm(
    result: FamilyTreeMutationResult,
    load: SavedCheck["load"],
    onVerified: () => void,
    command?: ReturnType<typeof useTreeCommand>,
  ) {
    check.current = { result, load, onVerified, command };
    setSaved(result);
    if (!command?.savedReadbackPending()) await retry();
  }
  return { saved, confirm, retry, pending: task.pending, error: task.error };
}
