import type * as FT from "@family-manager/family-api/models";
import {
  readFamilyTreeMergeSummary,
  readFamilyTreePurgeSummary,
} from "@family-manager/family-api";
import { ToolRuntime } from "./runtime";
import { validateJob } from "./safety";
import { operationKey } from "../workflows/state";
export class MergePurgeWorkflow {
  merge: FT.FamilyTreePreview | null = null;
  targetPerson: FT.FamilyTreePerson | null = null;
  purge: FT.FamilyTreePreview | null = null;
  mergeReview: {
    choices: Record<string, "source" | "target">;
    episodes: boolean;
  } | null = null;
  private mergeIntent: {
    body: FT.FamilyTreePreviewCommitRequest;
    source: number;
    target: number;
  } | null = null;
  private purgeIntent: {
    body: FT.FamilyTreePreviewCommitRequest;
    person: number;
  } | null = null;
  constructor(private r: ToolRuntime) {
    r.onReset(() => this.clear());
    r.onPersonRetired(() => this.clear());
  }
  async previewMerge(
    source: number,
    target: number,
    choices: Record<string, "source" | "target">,
    retainEpisodes: boolean,
  ) {
    this.r.editable(source);
    const available =
      this.r.core.state.candidatePeople?.items ??
      this.r.core.state.people?.items ??
      [];
    const person = available.find((p) => p.id === target);
    if (
      source === target ||
      !person ||
      person.is_locked ||
      person.merged_into_person_id ||
      person.archived_at
    )
      throw new Error("Select an available unlocked canonical target.");
    if (this.mergeIntent)
      throw new Error(
        "A commit has an uncertain outcome. Retry the original intent or explicitly discard it before a new preview.",
      );
    const revision = this.r.revision();
    const detail = await this.r.request(
      (o) => this.r.api.getFamilyTreePerson(target, o),
      "view",
    );
    if (
      detail.graph_revision !== revision ||
      detail.person.id !== target ||
      detail.person.is_locked ||
      detail.person.merged_into_person_id ||
      detail.person.archived_at
    )
      throw new Error(
        "Target changed. Refresh and choose an unlocked canonical target.",
      );
    const preview = await this.r.request((o) =>
      this.r.api.previewFamilyTreeMerge(
        {
          source_person_id: source,
          target_person_id: target,
          scalar_choices: { ...choices },
          retain_similar_partner_episodes: retainEpisodes,
          expected_graph_revision: revision,
        },
        o,
      ),
    );
    this.r.assertCurrent();
    const summary = readFamilyTreeMergeSummary(preview);
    if (
      !validateJob(preview, "merge", revision) ||
      !summary ||
      summary.source.id !== source ||
      summary.target.id !== target
    )
      throw new Error("Merge preview is invalid or stale.");
    this.targetPerson = detail.person;
    this.merge = preview;
    this.mergeReview = { choices: { ...choices }, episodes: retainEpisodes };
    this.r.changed();
  }
  async commitMerge(source: number, target: number, confirmed: boolean) {
    const retryReceipt = this.mergeIntent !== null;
    if (!confirmed) throw new Error("Confirm the exact merge target.");
    if (!this.mergeIntent) {
      this.r.editable(source);
      const p = this.merge,
        summary = p && readFamilyTreeMergeSummary(p);
      if (
        !p ||
        !summary ||
        !validateJob(p, "merge", this.r.revision()) ||
        summary.source.id !== source ||
        summary.target.id !== target ||
        summary.unresolved_fields.length ||
        summary.requires_partner_review
      )
        throw new Error(
          "Review a fresh resolved preview and confirm this merge target.",
        );
      this.r.claimIntent("merge");
      this.mergeIntent = {
        source,
        target,
        body: {
          preview_token: p.preview_token,
          expected_graph_revision: p.expected_graph_revision,
          idempotency_key: operationKey(),
          reviewed_warnings: summary.warnings.includes("chronology_review")
            ? ["chronology_review"]
            : [],
        },
      };
    }
    const intent = this.mergeIntent;
    if (
      intent.source !== source ||
      intent.target !== target ||
      (this.merge && this.merge.preview_token !== intent.body.preview_token)
    )
      throw new Error("Retry the original merge intent.");
    await this.r.request(
      (o) => this.r.api.commitFamilyTreeMerge(intent.body, o),
      "manage",
      target,
      "merge",
      retryReceipt,
      () => this.cancelMerge(),
    );
    this.r.releaseIntent("merge");
    this.merge = null;
    this.targetPerson = null;
    this.mergeReview = null;
    this.mergeIntent = null;
    this.r.changed();
  }
  async previewPurge(person: number, password: string) {
    this.r.editable(person, true);
    if (this.purgeIntent)
      throw new Error("Retry or explicitly discard the pending purge first.");
    if (!password) throw new Error("Enter your fresh password.");
    const revision = this.r.revision();
    const preview = await this.r.request(
      (o) =>
        this.r.api.previewFamilyTreePurge(
          person,
          { password, expected_graph_revision: revision },
          o,
        ),
      "purge",
    );
    this.r.assertCurrent();
    const summary = readFamilyTreePurgeSummary(preview);
    if (
      !validateJob(preview, "purge", revision) ||
      !summary ||
      summary.person_id !== person
    )
      throw new Error("Purge preview is invalid or stale.");
    this.purge = preview;
    this.r.changed();
  }
  async commitPurge(person: number, password: string, confirmed: boolean) {
    const retryReceipt = this.purgeIntent !== null;
    if (!password || !confirmed)
      throw new Error("Enter a fresh password and confirm the exact person.");
    if (!this.purgeIntent) {
      this.r.editable(person, true);
      const p = this.purge,
        summary = p && readFamilyTreePurgeSummary(p);
      if (
        !p ||
        !summary ||
        summary.person_id !== person ||
        !validateJob(p, "purge", this.r.revision())
      )
        throw new Error("Review a fresh target-specific purge preview.");
      this.r.claimIntent("purge");
      this.purgeIntent = {
        person,
        body: {
          preview_token: p.preview_token,
          expected_graph_revision: p.expected_graph_revision,
          idempotency_key: operationKey(),
        },
      };
    }
    const intent = this.purgeIntent;
    if (
      intent.person !== person ||
      (this.purge && this.purge.preview_token !== intent.body.preview_token)
    )
      throw new Error("Retry the original purge intent.");
    // Authentication is ephemeral per attempt and excluded by the server from receipt facts.
    await this.r.request(
      async (o) => {
        try {
          return await this.r.api.commitFamilyTreePurge(
            person,
            { ...intent.body, password },
            o,
          );
        } finally {
          password = "";
        }
      },
      "purge",
      null,
      "purge",
      retryReceipt,
      () => this.cancelPurge(),
    );
    this.r.releaseIntent("purge");
    this.purge = null;
    this.purgeIntent = null;
    this.r.changed();
  }
  get pendingMerge() {
    return this.mergeIntent !== null;
  }
  get pendingPurge() {
    return this.purgeIntent !== null;
  }
  cancelMerge() {
    this.r.releaseIntent("merge");
    this.merge = null;
    this.targetPerson = null;
    this.mergeReview = null;
    this.mergeIntent = null;
    this.r.changed();
  }
  cancelPurge() {
    this.r.releaseIntent("purge");
    this.purge = null;
    this.purgeIntent = null;
    this.r.changed();
  }
  clear() {
    this.cancelMerge();
    this.cancelPurge();
  }
}
