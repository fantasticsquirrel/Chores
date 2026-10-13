import { shellStyles } from "../../../styles/shell";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { readFamilyTreePurgeSummary } from "@family-manager/family-api";
import { ActionButton } from "../../../components/ActionButton";
import { TreeToggle } from "./NativeEditor";
import type { TreeTools } from "../hooks/useTreeTools";
import type { TreeState } from "../lib/workflows/state";
import { validateJob } from "../lib/advanced/safety";
export function PurgeTools({
  tools,
  state,
  onDirty,
}: {
  tools: TreeTools;
  state: TreeState;
  onDirty: (v: boolean) => void;
}) {
  const d = tools.decisions,
    r = tools.runtime,
    p = state.detail!.person;
  const [password, setPassword] = useState(""),
    [confirmed, setConfirmed] = useState(d.pendingPurge);
  const disabled =
    state.busy ||
    state.loading ||
    !!state.pending ||
    state.access !== "manage" ||
    state.collection?.capabilities.can_purge !== true ||
    (p.is_locked && !d.pendingPurge) ||
    (!!state.error && !d.pendingPurge);
  const summary = d.purge && readFamilyTreePurgeSummary(d.purge);
  async function execute(commit: boolean) {
    const fresh = password;
    setPassword("");
    try {
      if (commit) {
        await d.commitPurge(p.id, fresh, confirmed);
        onDirty(false);
      } else {
        await d.previewPurge(p.id, fresh);
        setConfirmed(false);
        onDirty(true);
      }
    } catch (e) {
      r.fail(e);
    }
  }
  return (
    <View>
      <Text style={shellStyles.mutedText}>
        Permanent purge removes only this person's facts and unshared
        references, never the account or other modules. Canonical targets with
        surviving aliases are blocked; explicitly purge each listed alias first,
        then obtain a new target preview. Locked people require explicit unlock.
      </Text>
      {r.blockingAliasIds.length ? (
        <Text style={shellStyles.mutedText}>
          Blocking same-household aliases:{" "}
          {r.blockingAliasIds.map((id) => `#${id}`).join(", ")}. Open these
          aliases in the archived directory and purge each explicitly before
          obtaining a fresh target preview.
        </Text>
      ) : null}
      <Text style={shellStyles.mutedText}>Fresh password</Text>
      <TextInput
        accessibilityLabel="Fresh password"
        secureTextEntry
        autoComplete="off"
        autoCorrect={false}
        value={password}
        editable={!disabled}
        onChangeText={setPassword}
      />
      <ActionButton
        label="Preview purge"
        disabled={disabled || !password || d.pendingPurge}
        onPress={() => void execute(false)}
      />
      {summary ? (
        <>
          <Text style={shellStyles.mutedText}>
            Purge person #{summary.person_id};{" "}
            {summary.alias_only
              ? "alias copy only — canonical records remain"
              : "canonical person facts"}
          </Text>
          <Text style={shellStyles.mutedText}>
            {summary.stories} stories · {summary.residences} residences ·{" "}
            {summary.media_references} media references
          </Text>
          <Text style={shellStyles.mutedText}>
            {summary.retained_backup_policy}
          </Text>
        </>
      ) : null}
      <TreeToggle
        label={`Confirm permanent purge of #${p.id}`}
        value={confirmed}
        disabled={disabled || !summary}
        onChange={setConfirmed}
      />
      <ActionButton
        label={d.pendingPurge ? "Retry original purge" : "Commit purge"}
        variant="danger"
        disabled={
          disabled ||
          !password ||
          !confirmed ||
          (!d.pendingPurge &&
            (!d.purge ||
              !validateJob(d.purge, "purge", state.collection?.graph_revision)))
        }
        onPress={() => void execute(true)}
      />
      <ActionButton
        label="Cancel purge preview / discard uncertain intent"
        disabled={state.busy}
        onPress={() => {
          setPassword("");
          setConfirmed(false);
          d.cancelPurge();
          onDirty(false);
        }}
      />
    </View>
  );
}
