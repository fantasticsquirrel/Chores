import { shellStyles } from "../../../styles/shell";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  readFamilyTreeExportSummary,
  readFamilyTreeImportSummary,
} from "@family-manager/family-api";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { TreeToggle } from "./NativeEditor";
import { validateJob } from "../lib/advanced/safety";
import type { TreeState } from "../lib/workflows/state";
import type { TreeTools } from "../hooks/useTreeTools";
export function TransferTools({
  tools,
  state,
}: {
  tools: TreeTools;
  state: TreeState;
}) {
  const [open, setOpen] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [duplicate, setDuplicate] = useState(false),
    [cancel, setCancel] = useState(false);
  const t = tools.transfer,
    r = tools.runtime,
    disabled = state.busy || state.loading || !!state.pending || !!state.error;
  const commitDisabled =
    state.busy ||
    state.loading ||
    !!state.pending ||
    (!!state.error && !t.pending);
  const manager =
    state.access === "manage" &&
    state.collection?.capabilities.can_manage === true;
  const canExport =
    manager && state.collection?.capabilities.can_export === true;
  const exporting = t.exporting && readFamilyTreeExportSummary(t.exporting),
    importing = t.importing && readFamilyTreeImportSummary(t.importing);
  const task = (f: () => Promise<unknown>) => {
    void f().catch((e) => r.fail(e));
  };
  if (!manager) return null;
  if (!open)
    return (
      <ActionButton
        label="Import / export"
        disabled={commitDisabled}
        variant="secondary"
        onPress={() => setOpen(true)}
      />
    );
  return (
    <SectionCard title="Logical import / export">
      <Text style={shellStyles.mutedText}>
        Exports contain household genealogy only, not accounts or a live
        database. Share/save is an explicit user action. Append import never
        replaces the tree or reconnects accounts. Private staging expires on the
        server.
      </Text>
      {r.working ? (
        <>
          <Text style={shellStyles.mutedText}>
            Working on a private transfer. Interrupting is not rollback;
            preserve the original command for explicit retry.
          </Text>
          <ActionButton
            label="Interrupt Family Tree transfer"
            onPress={() => r.interrupt()}
          />
        </>
      ) : null}
      {r.error ? (
        <Text style={shellStyles.mutedText} accessibilityRole="alert">
          {r.error}
        </Text>
      ) : null}
      {canExport ? (
        <>
          <ActionButton
            label="Create ZIP export"
            disabled={disabled}
            onPress={() => task(() => t.createExport("zip"))}
          />
          <ActionButton
            label="Create JSON export"
            disabled={disabled}
            onPress={() => task(() => t.createExport("json"))}
          />
          {t.exporting ? (
            <>
              <Text style={shellStyles.mutedText}>
                Export #{t.exporting.id}: {t.exporting.state} · expires{" "}
                {t.exporting.expires_at}
              </Text>
              {exporting ? (
                <>
                  <Text style={shellStyles.mutedText}>
                    {exporting.people} people · {exporting.media} media · format{" "}
                    {exporting.format}
                  </Text>
                  <Text style={shellStyles.mutedText}>
                    Media omitted: {exporting.media_omitted ? "yes" : "no"}
                  </Text>
                </>
              ) : null}
              <ActionButton
                label="Refresh export status"
                disabled={disabled}
                onPress={() => task(() => t.pollExport())}
              />
              <ActionButton
                label="Download and save / share export"
                disabled={disabled || !validateJob(t.exporting, "export")}
                onPress={() => task(() => t.download())}
              />
              <ActionButton
                label="Dismiss export details"
                disabled={state.busy}
                onPress={() => {
                  t.exporting = null;
                  r.changed();
                }}
              />
            </>
          ) : null}
        </>
      ) : (
        <Text style={shellStyles.mutedText}>
          Bulk export is not currently authorized.
        </Text>
      )}
      <ActionButton
        label="Choose JSON / ZIP append import"
        disabled={disabled || !!t.importing || t.pending}
        onPress={() => task(() => t.chooseImport())}
      />
      {t.selected ? (
        <>
          <Text style={shellStyles.mutedText}>
            Logical package selected · {t.selected.size} bytes · maximum 100 MiB
            input. Bounded validation occurs on the server.
          </Text>
          <ActionButton
            label="Upload and stage append import"
            disabled={disabled}
            onPress={() =>
              task(async () => {
                await t.stage();
                setConfirmed(false);
                setDuplicate(false);
              })
            }
          />
        </>
      ) : null}
      {t.importing ? (
        <>
          <Text style={shellStyles.mutedText}>
            Append import #{t.importing.id}: {t.importing.state} · revision{" "}
            {t.importing.expected_graph_revision} · expires{" "}
            {t.importing.expires_at}
          </Text>
          {importing ? (
            <>
              <Text style={shellStyles.mutedText}>
                {importing.people} people · {importing.relationships}{" "}
                relationships · {importing.stories} stories ·{" "}
                {importing.residences} residences · {importing.media} media
              </Text>
              <Text style={shellStyles.mutedText}>
                Missing media: {importing.missing_media}
              </Text>
              {importing.warnings.map((w, i) => (
                <Text style={shellStyles.mutedText} key={i}>
                  Warning: {w}
                </Text>
              ))}
              <Text style={shellStyles.mutedText}>
                Unsupported fields:{" "}
                {importing.unsupported_fields.join(", ") || "none"}
              </Text>
              {importing.duplicate_suggestions.map((s, i) => (
                <Text style={shellStyles.mutedText} key={i}>
                  Duplicate suggestion {s.source_key}:{" "}
                  {s.candidate_person_ids.map((id) => `#${id}`).join(", ")}
                </Text>
              ))}
              {importing.duplicate_provenance ? (
                <TreeToggle
                  label="Acknowledge duplicate import provenance"
                  value={duplicate}
                  disabled={disabled || t.pending}
                  onChange={setDuplicate}
                />
              ) : null}
            </>
          ) : (
            <Text style={shellStyles.mutedText}>
              Preview summary unavailable; no commit is permitted.
            </Text>
          )}
          <ActionButton
            label="Refresh import status"
            disabled={disabled}
            onPress={() => task(() => t.pollImport())}
          />
          <TreeToggle
            label={`Confirm reviewed append import #${t.importing.id}, including warnings and missing media`}
            value={confirmed}
            disabled={disabled || !importing}
            onChange={setConfirmed}
          />
          <ActionButton
            label={
              t.pending
                ? "Retry original append import"
                : "Commit append import"
            }
            disabled={
              commitDisabled ||
              !confirmed ||
              !importing ||
              (importing.duplicate_provenance && !duplicate) ||
              (!t.pending &&
                !validateJob(
                  t.importing,
                  "import",
                  state.collection?.graph_revision,
                ))
            }
            onPress={() =>
              task(async () => {
                await t.commit(confirmed, duplicate);
                setConfirmed(false);
                setDuplicate(false);
              })
            }
          />
        </>
      ) : null}
      {t.selected || t.importing ? (
        <ActionButton
          label="Cancel staged append import"
          disabled={state.busy}
          variant="secondary"
          onPress={() => setCancel(true)}
        />
      ) : null}
      {cancel ? (
        <>
          <Text style={shellStyles.mutedText}>
            Cancel this staged append? If a commit was interrupted, abort is not
            rollback; refresh its status first. A committed import cannot be
            undone by cancellation.
          </Text>
          <ActionButton
            label="Keep staged import"
            onPress={() => setCancel(false)}
          />
          <ActionButton
            label="Confirm cancel staged import"
            disabled={state.busy}
            variant="danger"
            onPress={() =>
              task(async () => {
                await t.cancel();
                setCancel(false);
                setConfirmed(false);
                setDuplicate(false);
              })
            }
          />
        </>
      ) : null}
      <ActionButton
        label="Hide import / export"
        disabled={state.busy}
        onPress={() => setOpen(false)}
      />
    </SectionCard>
  );
}
