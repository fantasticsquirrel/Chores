import type * as FT from "@family-manager/family-api/models";
import type { NativeSelection } from "./nativeFiles";
import { ToolRuntime } from "./runtime";
import { imageDataUri } from "./safety";
import { operationKey } from "../workflows/state";
export class MediaWorkflow {
  references: FT.FamilyTreeMediaReference[] = [];
  image: string | null = null;
  selected: NativeSelection | null = null;
  uploaded: FT.FamilyTreeMedia | null = null;
  caption = "";
  private selectedRevision: number | null = null;
  private referencesRevision: number | null = null;
  private untrack: (() => void) | null = null;
  private intent:
    | { kind: "attach"; asset: number; body: FT.FamilyTreeAttachMediaRequest }
    | {
        kind: "remove";
        asset: number;
        reference: number;
        reviewedReference: FT.FamilyTreeMediaReference;
        body: FT.FamilyTreeCommand;
      }
    | null = null;
  constructor(private r: ToolRuntime) {
    r.onReset(() => this.clear());
    r.onPersonRetired(() => this.clear());
  }
  async load(personId: number) {
    const revision =
      this.r.core.state.detail?.graph_revision ?? this.r.revision();
    this.image = null;
    const references = await this.r.request(
      (o) => this.r.api.listFamilyTreeMediaReferences(personId, o),
      "view",
    );
    this.r.assertCurrent();
    this.referencesRevision = revision;
    this.references = references;
    this.r.changed();
  }
  async choose() {
    if (this.intent)
      throw new Error(
        "Retry or explicitly discard the pending attachment before choosing another photograph.",
      );
    this.discard();
    const revision =
      this.r.core.state.detail?.graph_revision ?? this.r.revision();
    const selected = await this.r.request(async (o) => {
      const file = await this.r.files.pickPhotograph();
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
    this.selectedRevision = revision;
    this.selected = selected;
    this.uploaded = null;
    if (selected) this.untrack = this.r.track(selected.release);
    this.r.changed();
  }
  async upload() {
    if (this.uploaded) return;
    const selected = this.selected;
    if (!selected) throw new Error("Choose a photograph first.");
    const uploaded = await this.r.request((o) =>
      this.r.api.uploadFamilyTreeMedia(
        this.r.files.multipart(selected, { caption: this.caption }),
        o,
      ),
    );
    this.r.assertCurrent();
    this.uploaded = uploaded;
    selected.release();
    this.untrack?.();
    this.untrack = null;
    this.selected = null;
    this.r.changed();
  }
  async attach(
    personId: number,
    role: FT.FamilyTreeMediaRole,
    storyId: number | null,
  ) {
    const retryReceipt = this.intent !== null;
    if (!retryReceipt) this.r.editable(personId);
    if (!this.intent) {
      const revision =
        this.selectedRevision ?? this.r.core.state.detail!.graph_revision;
      await this.upload();
      this.r.claimIntent("media");
      this.intent = {
        kind: "attach",
        asset: this.uploaded!.id,
        body: {
          person_id: personId,
          role,
          story_id: role === "story" ? storyId : null,
          expected_graph_revision: revision,
          idempotency_key: operationKey(),
        },
      };
    }
    if (
      this.intent.kind !== "attach" ||
      this.intent.body.person_id !== personId ||
      this.intent.body.role !== role ||
      (role === "story" && this.intent.body.story_id !== storyId)
    )
      throw new Error(
        "Pending attachment target changed. Retry the original intent or discard it.",
      );
    const intent = this.intent;
    await this.r.request(
      (o) => this.r.api.attachFamilyTreeMedia(intent.asset, intent.body, o),
      "manage",
      personId,
      "media",
      retryReceipt,
      () => {
        this.r.releaseIntent("media");
        this.intent = null;
        this.uploaded = null;
        this.caption = "";
      },
    );
    this.r.releaseIntent("media");
    this.intent = null;
    this.uploaded = null;
    this.caption = "";
    await this.load(personId);
  }
  async remove(personId: number, reference: FT.FamilyTreeMediaReference) {
    const retryReceipt = this.intent !== null;
    if (!retryReceipt) this.r.editable(personId);
    if (reference.person_id !== personId)
      throw new Error("Photograph reference target changed.");
    if (!this.intent) {
      this.r.claimIntent("media");
      this.intent = {
        kind: "remove",
        asset: reference.asset_id,
        reference: reference.id,
        reviewedReference: reference,
        body: {
          expected_graph_revision:
            this.referencesRevision ?? this.r.core.state.detail!.graph_revision,
          idempotency_key: operationKey(),
        },
      };
    }
    const intent = this.intent;
    if (intent.kind !== "remove" || intent.reference !== reference.id)
      throw new Error(
        "Retry the original reference removal before changing target.",
      );
    await this.r.request(
      (o) =>
        this.r.api.removeFamilyTreeMediaReference(
          intent.asset,
          intent.reference,
          intent.body,
          o,
        ),
      "manage",
      personId,
      "media",
      retryReceipt,
      () => {
        this.r.releaseIntent("media");
        this.intent = null;
        this.uploaded = null;
        this.caption = "";
      },
    );
    this.r.releaseIntent("media");
    this.intent = null;
    await this.load(personId);
  }
  async view(assetId: number) {
    if (!this.references.some((ref) => ref.asset_id === assetId))
      throw new Error("Choose an authorized photograph reference.");
    const download = await this.r.request(
      (o) => this.r.api.getFamilyTreeMediaContent(assetId, o),
      "view",
    );
    if (this.r.current()) {
      this.image = imageDataUri(download);
      this.r.changed();
    }
  }
  get attachmentReview() {
    return this.intent?.kind === "attach" ? this.intent.body : null;
  }
  get removalReview() {
    return this.intent?.kind === "remove"
      ? this.intent.reviewedReference
      : null;
  }
  get pending() {
    return this.intent !== null;
  }
  discard() {
    this.r.releaseIntent("media");
    this.selected?.release();
    this.untrack?.();
    this.untrack = null;
    this.selected = null;
    this.uploaded = null;
    this.intent = null;
    this.caption = "";
    this.selectedRevision = null;
    this.referencesRevision = null;
    this.image = null;
    this.r.changed();
  }
  clear() {
    this.discard();
    this.references = [];
  }
}
