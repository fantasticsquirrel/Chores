import type * as FT from "@family-manager/family-api/models";
import {
  readFamilyTreeExportSummary,
  readFamilyTreeImportSummary,
} from "@family-manager/family-api";
import type { NativeSelection } from "./nativeFiles";
import { ToolRuntime } from "./runtime";
import { validateJob } from "./safety";
import { operationKey } from "../workflows/state";
export class TransferWorkflow {
  exporting: FT.FamilyTreeJob | null = null;
  importing: FT.FamilyTreeJob | null = null;
  selected: NativeSelection | null = null;
  private untrack: (() => void) | null = null;
  private stageRevision: number | null = null;
  private intent: {
    job: number;
    body: FT.FamilyTreeImportCommitRequest;
  } | null = null;
  constructor(private r: ToolRuntime) {
    r.onReset(() => this.clear());
  }
  async createExport(format: FT.FamilyTreeExportFormat) {
    const job = await this.r.request(
      (o) => this.r.api.createFamilyTreeExport({ format }, o),
      "export",
    );
    this.r.assertCurrent();
    if (job.kind !== "export" || !readFamilyTreeExportSummary(job))
      throw new Error("Invalid export summary.");
    this.exporting = job;
    this.r.changed();
  }
  async pollExport() {
    if (!this.exporting) throw new Error("Create an export first.");
    const id = this.exporting.id,
      job = await this.r.request(
        (o) => this.r.api.getFamilyTreeExportJob(id, o),
        "export",
      );
    this.r.assertCurrent();
    if (
      job.id !== id ||
      job.kind !== "export" ||
      !readFamilyTreeExportSummary(job)
    )
      throw new Error("Invalid export status.");
    this.exporting = job;
    this.r.changed();
  }
  async download() {
    const job = this.exporting;
    if (!job || !validateJob(job, "export"))
      throw new Error(
        "Refresh the ready, unexpired export before downloading.",
      );
    await this.r.request(async (o) => {
      const bytes = await this.r.api.downloadFamilyTreeExport(job.id, o);
      if (!this.r.current() || o.signal?.aborted)
        throw new Error("Export interrupted.");
      await this.r.files.shareDownload(
        bytes,
        () => this.r.current() && !o.signal?.aborted,
        this.r.trackTransfer,
      );
      if (o.signal?.aborted)
        throw Object.assign(new Error("Export interrupted."), {
          name: "AbortError",
        });
    }, "export");
  }
  async chooseImport() {
    if (this.importing || this.intent)
      throw new Error(
        "Cancel the existing staged import before choosing another package.",
      );
    this.releaseSelection();
    const selected = await this.r.request(async (o) => {
      const file = await this.r.files.pickPackage();
      if (!this.r.current() || o.signal?.aborted) {
        file?.release();
        throw new Error("Family Tree access changed.");
      }
      return file;
    });
    if (!this.r.current()) {
      selected?.release();
      return;
    }
    this.selected = selected;
    this.stageRevision = this.r.revision();
    if (selected) this.untrack = this.r.track(selected.release);
    this.r.changed();
  }
  async stage() {
    const selected = this.selected,
      revision = this.stageRevision;
    if (!selected || revision === null)
      throw new Error("Choose a logical JSON/ZIP package first.");
    if (revision !== this.r.revision())
      throw new Error(
        "Collection changed. Cancel this selection and choose a package against a refreshed revision.",
      );
    const job = await this.r.request((o) =>
      this.r.api.stageFamilyTreeImport(
        this.r.files.multipart(selected, {
          expected_graph_revision: String(revision),
        }),
        o,
      ),
    );
    this.r.assertCurrent();
    if (
      !validateJob(job, "import", revision) ||
      !readFamilyTreeImportSummary(job)
    )
      throw new Error("Invalid or expired import preview.");
    this.importing = job;
    this.releaseSelection();
    this.r.changed();
  }
  async pollImport() {
    if (!this.importing) throw new Error("Stage an import first.");
    const id = this.importing.id,
      job = await this.r.request(
        (o) => this.r.api.getFamilyTreeImportJob(id, o),
        "manage",
        undefined,
        "import",
      );
    this.r.assertCurrent();
    if (
      job.id !== id ||
      job.kind !== "import" ||
      !readFamilyTreeImportSummary(job)
    )
      throw new Error("Invalid import status.");
    this.importing = job;
    this.r.changed();
  }
  async commit(confirmed: boolean, acknowledge: boolean) {
    const retryReceipt = this.intent !== null;
    const job = this.importing,
      s = job && readFamilyTreeImportSummary(job);
    if (!confirmed || !job || !s)
      throw new Error("Confirm the reviewed append target.");
    if (!this.intent) {
      if (
        !validateJob(job, "import", this.r.revision()) ||
        (s.duplicate_provenance && !acknowledge)
      )
        throw new Error(
          "Review a fresh append preview, including duplicate provenance.",
        );
      this.r.claimIntent("import");
      this.intent = {
        job: job.id,
        body: {
          expected_graph_revision: job.expected_graph_revision,
          idempotency_key: operationKey(),
          confirmed: true,
          acknowledge_duplicate_provenance: acknowledge,
          reviewed_warnings: s.warnings.includes("chronology_review")
            ? ["chronology_review"]
            : [],
        },
      };
    }
    const intent = this.intent;
    if (
      intent.job !== job.id ||
      intent.body.acknowledge_duplicate_provenance !== acknowledge
    )
      throw new Error(
        "Retry the original import confirmation without changing its body.",
      );
    await this.r.request(
      (o) => this.r.api.commitFamilyTreeImport(intent.job, intent.body, o),
      "manage",
      this.r.core.state.selectedId,
      "import",
      retryReceipt,
      () => {
        this.r.releaseIntent("import");
        this.importing = null;
        this.intent = null;
        this.r.changed();
      },
    );
    this.r.releaseIntent("import");
    this.importing = null;
    this.intent = null;
    this.r.changed();
  }
  async cancel() {
    if (this.importing) {
      const id = this.importing.id,
        job = await this.r.request(
          (o) => this.r.api.cancelFamilyTreeImport(id, o),
          "manage",
          undefined,
          "import",
        );
      if (job.id !== id || job.kind !== "import" || job.state !== "canceled")
        throw new Error(
          "Import cancellation was not confirmed. Refresh its status.",
        );
    }
    this.r.releaseIntent("import");
    this.importing = null;
    this.intent = null;
    this.releaseSelection();
    this.r.changed();
  }
  get pending() {
    return this.intent !== null;
  }
  releaseSelection() {
    this.selected?.release();
    this.untrack?.();
    this.untrack = null;
    this.selected = null;
    this.stageRevision = null;
  }
  clear() {
    this.r.releaseIntent("import");
    this.exporting = null;
    this.importing = null;
    this.intent = null;
    this.releaseSelection();
    this.r.changed();
  }
}
