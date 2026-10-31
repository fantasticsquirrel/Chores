import { useExpiry } from "../hooks/useExpiry";
import { useEffect, useState } from "react";
import { readFamilyTreeExportSummary } from "@family-manager/family-api/models/family-tree-summary";
import {
  apiClient,
  type FamilyTreeJob,
  type FamilyTreeExportFormat,
} from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { jobIssue, downloadLogicalExport } from "../lib/workflows/advanced";

export function LogicalExport({ canExport }: { canExport: boolean }) {
  const runtime = useTreeRuntime(),
    task = useTreeTask();
  const [format, setFormat] = useState<FamilyTreeExportFormat>("zip"),
    [job, setJob] = useState<FamilyTreeJob | null>(null),
    [message, setMessage] = useState("");
  const now = useExpiry(job),
    summary = job ? readFamilyTreeExportSummary(job) : null;
  useEffect(() => {
    if (!canExport) {
      setJob(null);
      setMessage("");
    }
  }, [canExport]);
  if (!canExport) return <p>You do not have permission to export this tree.</p>;
  const blocked =
    !runtime.manage || !runtime.online || runtime.busy || runtime.checking;
  const issue = job
    ? jobIssue(job, "export", job.expected_graph_revision, now) ||
      (!summary ? "Export summary is incomplete. Generate a new export." : null)
    : null;
  async function create() {
    if (blocked) return;
    setJob(null);
    setMessage("");
    const result = await task.run(async (options) => {
      const created = await apiClient.createFamilyTreeExport(
        { format },
        options,
      );
      const issue = jobIssue(
        created,
        "export",
        created.expected_graph_revision,
      );
      if (issue || created.expected_graph_revision < runtime.revision())
        throw new Error(
          issue ||
            "The export snapshot is older than the current known tree. Generate it again.",
        );
      const readback = await apiClient.getFamilyTreeExportJob(
        created.id,
        options,
      );
      if (
        readback.id !== created.id ||
        readback.expected_graph_revision !== created.expected_graph_revision ||
        jobIssue(readback, "export", created.expected_graph_revision) ||
        !readFamilyTreeExportSummary(readback)
      )
        throw new Error(
          "Export readback did not confirm the created snapshot. Generate it again.",
        );
      return readback;
    });
    if (result) setJob(result);
  }
  async function download() {
    if (blocked || !job || !summary || issue) return;
    const saved = await task.run(async (options) => {
      const checked = await apiClient.getFamilyTreeExportJob(job.id, options);
      const problem = jobIssue(checked, "export", job.expected_graph_revision);
      const checkedSummary = readFamilyTreeExportSummary(checked);
      if (
        problem ||
        checked.id !== job.id ||
        !checkedSummary ||
        checkedSummary.format !== summary.format
      )
        throw new Error(problem || "The export job changed. Regenerate it.");
      const bytes = await apiClient.downloadFamilyTreeExport(job.id, options);
      return { bytes, format: checkedSummary.format };
    });
    if (saved) {
      try {
        downloadLogicalExport(saved.bytes, saved.format);
        setMessage("Export downloaded. Store the file somewhere secure.");
      } catch (error) {
        task.setError(
          error instanceof Error
            ? error.message
            : "Export could not be downloaded.",
        );
      }
    }
  }
  return (
    <section
      className="family-tree-record-form family-tree-advanced-form"
      aria-label="Logical export"
    >
      <h3>Logical export</h3>
      <label>
        Export format
        <select
          value={format}
          disabled={blocked}
          onChange={(e) => setFormat(e.target.value as FamilyTreeExportFormat)}
        >
          <option value="zip">
            Complete ZIP manifest and referenced media
          </option>
          <option value="json">Metadata-only JSON; no image bytes</option>
        </select>
      </label>
      <Button disabled={blocked} onClick={() => void create()}>
        Create logical export
      </Button>
      {summary ? (
        <>
          <p>
            {summary.format === "json"
              ? "Metadata-only JSON: image bytes are omitted; this is not a self-contained media backup."
              : "ZIP: logical records and validated referenced media only; not the live application database."}
          </p>
          <p>
            People: {summary.people} · Media: {summary.media} · Expires{" "}
            {job?.expires_at}
          </p>
          <Button disabled={blocked || !!issue} onClick={() => void download()}>
            Download authorized export
          </Button>
        </>
      ) : null}
      {issue || task.error ? (
        <InlineNotice variant="error">{issue || task.error}</InlineNotice>
      ) : null}
      <p role="status">
        {task.pending
          ? "Generating or retrieving an authorized private export…"
          : message}
      </p>
    </section>
  );
}
