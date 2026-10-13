import { shellStyles } from "../../../styles/shell";
import { useState } from "react";
import { Text, View } from "react-native";
import { readFamilyTreeMergeSummary } from "@family-manager/family-api";
import { ActionButton } from "../../../components/ActionButton";
import { TreeTextField, TreeToggle } from "./NativeEditor";
import { duplicateSuggestions, validateJob } from "../lib/advanced/safety";
import { personName } from "../lib/workflows/view";
import type { TreeTools } from "../hooks/useTreeTools";
import type { TreeState, TreeWorkflow } from "../lib/workflows/treeWorkflow";
export function MergeTools({
  tools,
  state,
  core,
  onDirty,
}: {
  tools: TreeTools;
  state: TreeState;
  core: TreeWorkflow;
  onDirty: (v: boolean) => void;
}) {
  const d = tools.decisions,
    r = tools.runtime,
    p = state.detail!.person;
  const [target, setTarget] = useState<number | null>(
      d.pendingMerge ? (d.targetPerson?.id ?? null) : null,
    ),
    [choices, setChoices] = useState<Record<string, "source" | "target">>(
      d.pendingMerge ? (d.mergeReview?.choices ?? {}) : {},
    ),
    [episodes, setEpisodes] = useState(
      d.pendingMerge && !!d.mergeReview?.episodes,
    ),
    [confirmed, setConfirmed] = useState(d.pendingMerge),
    [query, setQuery] = useState(""),
    [fields, setFields] = useState<string[]>(
      d.pendingMerge && d.merge
        ? (readFamilyTreeMergeSummary(d.merge)?.conflicting_fields ?? [])
        : [],
    );
  const available = (state.candidatePeople ?? state.people)?.items ?? [],
    suggestions = duplicateSuggestions(p, available);
  const summary = d.merge && readFamilyTreeMergeSummary(d.merge);
  const disabled =
    state.busy ||
    state.loading ||
    !!state.pending ||
    state.access !== "manage" ||
    (!d.pendingMerge &&
      (p.is_locked ||
        !!p.archived_at ||
        !!p.merged_into_person_id ||
        !!state.error));
  const task = (f: () => Promise<unknown>) => {
    void f().catch((e) => r.fail(e));
  };
  const value = (person: unknown, field: string) => {
    const entered = (person as Record<string, unknown> | null)?.[field];
    return entered === null || entered === undefined
      ? "Unknown / not entered"
      : typeof entered === "string"
        ? entered
        : JSON.stringify(entered);
  };
  const invalidate = () => {
    if (!d.pendingMerge) {
      d.merge = null;
      setConfirmed(false);
      r.changed();
    }
    onDirty(true);
  };
  return (
    <View>
      <Text style={shellStyles.mutedText}>
        Advisory duplicates from the available authorized directory only. Names
        do not establish ancestry. Merging preserves records and creates a
        non-editable alias; no unmerge.
      </Text>
      <Text style={shellStyles.mutedText}>
        Suggested duplicate IDs:{" "}
        {suggestions.map((x) => `#${x.id}`).join(", ") ||
          "none in this bounded page"}
      </Text>
      <TreeTextField
        label="Search merge target"
        value={query}
        onChange={setQuery}
        disabled={disabled || d.pendingMerge}
      />
      <ActionButton
        label="Search merge candidates"
        disabled={disabled || d.pendingMerge}
        onPress={() => task(() => core.searchCandidates(query))}
      />
      {available
        .filter((x) => x.id !== p.id)
        .map((x) => (
          <ActionButton
            key={x.id}
            label={`Merge into ${personName(x)} (#${x.id})`}
            disabled={
              disabled ||
              d.pendingMerge ||
              x.is_locked ||
              !!x.archived_at ||
              !!x.merged_into_person_id
            }
            onPress={() => {
              invalidate();
              setTarget(x.id);
              setFields([]);
              setChoices({});
              setEpisodes(false);
            }}
          />
        ))}
      {state.candidatePeople?.next_cursor ? (
        <ActionButton
          label="More merge candidates"
          disabled={disabled}
          onPress={() => task(() => core.moreCandidates())}
        />
      ) : null}
      {summary ? (
        <>
          <Text style={shellStyles.mutedText}>
            Preview source #{summary.source.id} into target #{summary.target.id}
          </Text>
          <Text style={shellStyles.mutedText}>
            Retarget aliases:{" "}
            {summary.retargeted_alias_ids.map((id) => `#${id}`).join(", ") ||
              "none"}
          </Text>
          <Text style={shellStyles.mutedText}>
            Retain {summary.retained_records.stories} stories,{" "}
            {summary.retained_records.residences} residences,{" "}
            {summary.retained_records.media_references} media references,{" "}
            {summary.retained_records.tags} tags and{" "}
            {summary.retained_records.names} names.
          </Text>
          <Text style={shellStyles.mutedText}>
            Relationship rewrites:{" "}
            {summary.relationship_changes
              .map((x) => `${x.table} #${x.id}: ${x.endpoints.join(" → ")}`)
              .join("; ") || "none"}
          </Text>
          <Text style={shellStyles.mutedText}>
            Similar partnership episodes:{" "}
            {summary.similar_partner_episode_ids.join(", ") || "none"}. Keep
            separate episodes only after explicit review.
          </Text>
          {summary.warnings.map((w, i) => (
            <Text style={shellStyles.mutedText} key={i}>
              {w}
            </Text>
          ))}
        </>
      ) : null}
      {fields.map((field) => (
        <View key={field}>
          <Text style={shellStyles.mutedText}>
            Retain scalar field: {field}
          </Text>
          <Text style={shellStyles.mutedText}>
            Source {field}: {value(p, field)}
          </Text>
          <Text style={shellStyles.mutedText}>
            Target {field}: {value(d.targetPerson, field)}
          </Text>
          {(["source", "target"] as const).map((side) => (
            <TreeToggle
              key={side}
              label={`Retain ${field} from ${side}`}
              value={choices[field] === side}
              disabled={disabled || d.pendingMerge}
              onChange={() => {
                invalidate();
                setChoices((old) => ({ ...old, [field]: side }));
              }}
            />
          ))}
        </View>
      ))}
      <TreeToggle
        label="Retain separate similar partnership episodes"
        value={episodes}
        disabled={disabled || d.pendingMerge}
        onChange={(v) => {
          invalidate();
          setEpisodes(v);
        }}
      />
      <ActionButton
        label="Preview merge"
        disabled={disabled || target === null || d.pendingMerge}
        onPress={() =>
          task(async () => {
            await d.previewMerge(p.id, target!, choices, episodes);
            setFields(
              readFamilyTreeMergeSummary(d.merge!)?.conflicting_fields ?? [],
            );
            setConfirmed(false);
            onDirty(true);
          })
        }
      />
      <TreeToggle
        label={`Confirm merge #${p.id} into #${target ?? "none"}`}
        value={confirmed}
        disabled={disabled || !summary}
        onChange={setConfirmed}
      />
      <ActionButton
        label={d.pendingMerge ? "Retry original merge" : "Commit merge"}
        variant="danger"
        disabled={
          disabled ||
          !confirmed ||
          !summary ||
          summary.unresolved_fields.length > 0 ||
          summary.requires_partner_review ||
          !d.merge ||
          (!d.pendingMerge &&
            !validateJob(d.merge, "merge", state.collection?.graph_revision))
        }
        onPress={() =>
          task(async () => {
            await d.commitMerge(p.id, target!, confirmed);
            onDirty(false);
          })
        }
      />
      <ActionButton
        label="Cancel merge preview / discard uncertain intent"
        disabled={state.busy}
        variant="secondary"
        onPress={() => {
          d.cancelMerge();
          setConfirmed(false);
          onDirty(false);
        }}
      />
    </View>
  );
}
