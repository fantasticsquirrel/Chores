import { useRef, useState } from "react";
import { useTreeSavedReadback } from "../hooks/useTreeSavedReadback";
import {
  apiClient,
  type FamilyTreeMedia,
  type FamilyTreePerson,
  type FamilyTreeStoriesPage,
  type FamilyTreeStory,
  type FamilyTreeMediaRole,
} from "../../../api";
import { Button } from "../../../ui";
import { useTreeRuntime, useTreeCommand } from "../hooks/useTreeCommand";
import { useTreeTask } from "../hooks/useTreeTask";
import { useTreePages } from "../hooks/useTreeReads";
import { fileIssue } from "../lib/workflows/advanced";
import { AdvancedFeedback } from "./AdvancedFeedback";
export function MediaUpload({
  person,
  originRevision,
  onDirty,
  onSaved,
}: {
  person: FamilyTreePerson;
  originRevision: number;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const runtime = useTreeRuntime(),
    task = useTreeTask(),
    command = useTreeCommand();
  const baseline = useRef(originRevision);
  const readback = useTreeSavedReadback();
  const [file, setFile] = useState<File | null>(null),
    [caption, setCaption] = useState(""),
    [asset, setAsset] = useState<FamilyTreeMedia | null>(null),
    [role, setRole] = useState<FamilyTreeMediaRole>("gallery"),
    [storyId, setStoryId] = useState("");
  const stories = useTreePages<FamilyTreeStory, FamilyTreeStoriesPage>(
    ["media-story-options", person.id],
    (cursor, options) =>
      apiClient.listFamilyTreeStories(
        person.id,
        { cursor, limit: 40 },
        options,
      ),
    role === "story",
  );
  const blocked =
    !runtime.manage ||
    !runtime.online ||
    runtime.busy ||
    runtime.checking ||
    !!readback.saved ||
    person.is_locked ||
    !!person.merged_into_person_id ||
    !!person.archived_at;
  async function upload() {
    if (!file || blocked) return;
    const problem = fileIssue(file, "image");
    if (problem) {
      task.setError(problem);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    if (caption) body.append("caption", caption);
    const ready = await task.run((options) =>
      apiClient.uploadFamilyTreeMedia(body, options),
    );
    if (ready) {
      if (
        ready.state !== "ready" ||
        !Number.isSafeInteger(ready.id) ||
        ready.id <= 0
      ) {
        task.setError(
          "Uploaded asset was not ready. Choose the file and retry.",
        );
        return;
      }
      setAsset(ready);
      onDirty(true);
    }
  }
  async function attach(reviewedChronology = false) {
    if (
      !asset ||
      blocked ||
      (role === "story" &&
        (!storyId ||
          !stories.consistent ||
          stories.revision === undefined ||
          stories.revision < runtime.floor.current))
    )
      return;
    const result = reviewedChronology
      ? await command.reapply()
      : await command.submit(
          (intent, options) =>
            apiClient.attachFamilyTreeMedia(
              asset.id,
              {
                ...intent,
                person_id: person.id,
                role,
                story_id: role === "story" ? Number(storyId) : null,
              },
              options,
            ),
          baseline.current,
        );
    if (result) {
      await readback.confirm(
        result,
        async (_receipt, options) => {
          await apiClient.listFamilyTreeMediaReferences(person.id, options);
          return true;
        },
        () => {
          onDirty(false);
          onSaved();
        },
        command,
      );
    }
  }
  return (
    <section className="family-tree-record-form family-tree-advanced-form">
      <p>
        Upload a sanitized app copy (JPEG, PNG or WebP, at most 10 MiB).
        Location/EXIF metadata is stripped by the server. Your source original
        remains on your device. No remote image URL is fetched.
      </p>
      <label>
        Photograph file
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={blocked || !!asset || command.hasAttempt}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            onDirty(!!e.target.files?.length);
          }}
        />
      </label>
      <label>
        Photo caption
        <input
          value={caption}
          maxLength={1000}
          disabled={blocked || !!asset || command.hasAttempt}
          onChange={(e) => {
            setCaption(e.target.value);
            onDirty(true);
          }}
        />
      </label>
      {!asset ? (
        <Button disabled={!file || blocked} onClick={() => void upload()}>
          Upload sanitized copy
        </Button>
      ) : (
        <p>
          Sanitized asset {asset.id} is ready; it is not attached until you
          confirm below.
        </p>
      )}
      <label>
        Photo use
        <select
          value={role}
          disabled={blocked || command.hasAttempt}
          onChange={(e) => {
            setRole(e.target.value as FamilyTreeMediaRole);
            onDirty(true);
          }}
        >
          <option value="gallery">Person gallery</option>
          <option value="primary">Primary photograph</option>
          <option value="story">Story photograph</option>
        </select>
      </label>
      {role === "story" ? (
        <>
          <label>
            Recorded story
            <select
              value={storyId}
              disabled={
                blocked ||
                command.hasAttempt ||
                !stories.consistent ||
                stories.revision === undefined ||
                stories.revision < runtime.floor.current
              }
              onChange={(e) => setStoryId(e.target.value)}
            >
              <option value="">Choose a recorded story</option>
              {stories.items.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title} (story {story.id})
                </option>
              ))}
            </select>
          </label>
          {stories.isPending ? <p>Loading story references…</p> : null}
          {stories.error ? (
            <p>
              Story options unavailable.{" "}
              <Button onClick={() => void stories.refetch()}>
                Retry story options
              </Button>
            </p>
          ) : null}
          {stories.hasNextPage ? (
            <Button onClick={() => void stories.fetchNextPage()}>
              Load more story options
            </Button>
          ) : null}
        </>
      ) : null}
      <AdvancedFeedback
        error={readback.error || task.error}
        command={command}
        blocked={!!blocked}
        onChronology={() => attach(true)}
        onReload={async () => {
          await command.reviewLatest();
        }}
      />
      {command.state.kind === "conflict" && command.state.reviewed ? (
        <Button
          disabled={command.state.reviewedRevision === undefined}
          onClick={() => {
            if (command.state.reviewedRevision === undefined) return;
            baseline.current = command.state.reviewedRevision;
            command.resetIntent();
          }}
        >
          Use reviewed revision for attachment
        </Button>
      ) : null}
      {readback.saved ? (
        <Button
          disabled={
            !runtime.manage ||
            !runtime.online ||
            runtime.busy ||
            runtime.checking
          }
          onClick={() => void readback.retry()}
        >
          Retry saved photograph readback
        </Button>
      ) : null}
      <p role="status">
        {task.pending
          ? "Uploading and validating private image bytes…"
          : command.state.busy
            ? "Attaching photograph and checking readback…"
            : ""}
      </p>
      <Button
        disabled={
          !asset ||
          blocked ||
          (role === "story" && !storyId) ||
          command.state.kind === "conflict" ||
          command.state.kind === "chronology"
        }
        onClick={() => void attach()}
      >
        Attach photograph
      </Button>
    </section>
  );
}
