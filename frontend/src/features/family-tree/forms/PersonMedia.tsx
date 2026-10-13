import { useEffect, useRef, useState } from "react";
import { apiClient, type FamilyTreePerson } from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { useTreeRead } from "../hooks/useTreeReads";
import { FamilyTreeDialog } from "../components/FamilyTreeDialog";
import { privateImageBlob } from "../lib/workflows/advanced";
import { confirmEditor, type EditorSpec } from "../lib/workflows/editors";
import { MediaUpload } from "./MediaUpload";
import { DraftClose } from "./AdvancedFeedback";
export function PersonMedia({
  person,
  originRevision,
  onEdit: requestEdit,
}: {
  person: FamilyTreePerson;
  originRevision: number;
  onEdit: (editor: EditorSpec) => void;
}) {
  const runtime = useTreeRuntime(),
    task = useTreeTask(false);
  const references = useTreeRead(
    ["media", person.id],
    async (options) => {
      const before = await apiClient.getFamilyTreeCollection(options);
      const items = await apiClient.listFamilyTreeMediaReferences(
        person.id,
        options,
      );
      const after = await apiClient.getFamilyTreeCollection(options);
      if (before.graph_revision !== after.graph_revision)
        throw new Error(
          "Photograph references changed while loading. Reload before editing.",
        );
      return { items, graph_revision: after.graph_revision };
    },
    !person.merged_into_person_id,
  );
  const onEdit = (spec: EditorSpec) => {
    if (!references.data || references.isFetching || references.error) return;
    requestEdit({
      ...spec,
      originRevision: Math.min(originRevision, references.data.graph_revision),
      reviewTarget: { entity: "media", id: person.id },
      reviewFacts: { references: references.data.items },
    });
  };
  const [upload, setUpload] = useState(false),
    [discard, setDiscard] = useState(false),
    [image, setImage] = useState<{ url: string; caption: string } | null>(null);
  const dirty = useRef(false),
    url = useRef<string | null>(null);
  function revokeImage() {
    if (url.current) {
      URL.revokeObjectURL(url.current);
      url.current = null;
    }
    setImage(null);
  }
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  useEffect(() => {
    if (runtime.authorizedManage === false) {
      setUpload(false);
      setDiscard(false);
      dirty.current = false;
    }
  }, [runtime.authorizedManage]);
  const editable =
    runtime.manage &&
    runtime.online &&
    !runtime.busy &&
    !runtime.checking &&
    originRevision >= runtime.floor.current &&
    !person.is_locked &&
    !person.archived_at &&
    !person.merged_into_person_id;
  function close() {
    if (runtime.busy) return;
    if (upload && dirty.current) {
      setDiscard(true);
      return;
    }
    setUpload(false);
    revokeImage();
  }
  return (
    <section aria-label="Managed photographs">
      <h3>Photographs</h3>
      {runtime.manage && !person.merged_into_person_id ? (
        <Button
          disabled={!editable}
          onClick={() => {
            dirty.current = false;
            setUpload(true);
          }}
        >
          Upload photograph
        </Button>
      ) : null}
      {references.isPending && !person.merged_into_person_id ? (
        <p>Loading authorized image references…</p>
      ) : null}
      {references.error ? (
        <InlineNotice variant="error">
          {formatApiError(references.error)}{" "}
          <Button
            disabled={!runtime.online || runtime.busy}
            onClick={() => void references.refetch()}
          >
            Retry photographs
          </Button>
        </InlineNotice>
      ) : null}
      {references.data?.items.length === 0 ? (
        <p>No photographs attached.</p>
      ) : null}
      <ul>
        {references.data?.items.map((reference) => (
          <li key={reference.id}>
            <p>
              {reference.role} photograph {reference.asset_id}
              {reference.story_id ? ` · story ${reference.story_id}` : ""}:{" "}
              {reference.asset.caption ?? "No caption"}
            </p>
            <Button
              disabled={!runtime.online || runtime.busy || runtime.checking}
              onClick={() =>
                void task
                  .run(async (options) => {
                    const bytes = await apiClient.getFamilyTreeMediaContent(
                      reference.asset_id,
                      options,
                    );
                    return privateImageBlob(bytes, reference.asset.mime_type);
                  })
                  .then((blob) => {
                    if (blob) {
                      revokeImage();
                      url.current = URL.createObjectURL(blob);
                      setImage({
                        url: url.current,
                        caption:
                          reference.asset.caption ??
                          `Recorded photograph ${reference.asset_id}`,
                      });
                    }
                  })
              }
            >
              View photograph {reference.asset_id}
            </Button>
            {runtime.manage ? (
              <>
                {reference.role !== "primary" ? (
                  <Button
                    disabled={!editable}
                    onClick={() =>
                      onEdit(
                        confirmEditor(
                          "Set primary photograph",
                          `Use asset ${reference.asset_id} as this person's primary photograph. Existing gallery/story references are retained.`,
                          (intent, options) =>
                            apiClient.attachFamilyTreeMedia(
                              reference.asset_id,
                              {
                                ...intent,
                                person_id: person.id,
                                role: "primary",
                              },
                              options,
                            ),
                        ),
                      )
                    }
                  >
                    Set photograph {reference.asset_id} primary
                  </Button>
                ) : null}
                <Button
                  disabled={!editable}
                  onClick={() =>
                    onEdit(
                      confirmEditor(
                        "Remove photograph reference",
                        `Remove only this ${reference.role} reference. Shared photographs and retained backups/exports are not erased.`,
                        (intent, options) =>
                          apiClient.removeFamilyTreeMediaReference(
                            reference.asset_id,
                            reference.id,
                            intent,
                            options,
                          ),
                      ),
                    )
                  }
                >
                  Remove photograph reference {reference.id}
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {task.error ? (
        <InlineNotice variant="error">{task.error}</InlineNotice>
      ) : null}
      {task.pending ? (
        <p role="status">Loading private photograph bytes…</p>
      ) : null}
      <FamilyTreeDialog
        open={upload || !!image}
        title={upload ? "Upload and attach photograph" : "Private photograph"}
        onRequestClose={close}
      >
        <DraftClose
          discard={discard}
          onKeep={() => setDiscard(false)}
          onDiscard={() => {
            dirty.current = false;
            setDiscard(false);
            setUpload(false);
          }}
        />
        {upload ? (
          <div hidden={discard}>
            <MediaUpload
              person={person}
              originRevision={originRevision}
              onDirty={(value) => {
                dirty.current = value;
              }}
              onSaved={() => {
                dirty.current = false;
                setUpload(false);
                void references.refetch();
              }}
            />
          </div>
        ) : null}
        {image ? (
          <figure>
            <img
              src={image.url}
              alt={image.caption}
              style={{ maxWidth: "100%", maxHeight: "60vh" }}
            />
            <figcaption>{image.caption}</figcaption>
          </figure>
        ) : null}
      </FamilyTreeDialog>
    </section>
  );
}
