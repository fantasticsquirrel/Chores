import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreeStoriesPage,
  type FamilyTreeResidencesPage,
  type FamilyTreeStory,
  type FamilyTreeResidence,
} from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreePages } from "../hooks/useTreeReads";
import { personName } from "../lib/workflows/workflows";
import {
  confirmEditor,
  storyEditor,
  residenceEditor,
  type EditorSpec,
} from "../lib/workflows/editors";
import { SafeMarkdown } from "./SafeMarkdown";
import { formatDate } from "../lib/workflows/personPresentation";
export function PersonNarratives({
  person,
  editable,
  onEdit,
}: {
  person: FamilyTreePerson;
  editable: boolean;
  onEdit: (spec: EditorSpec) => void;
}) {
  const runtime = useTreeRuntime();
  const stories = useTreePages<FamilyTreeStory, FamilyTreeStoriesPage>(
    ["stories", person.id],
    (cursor, requestOptions) =>
      apiClient.listFamilyTreeStories(
        person.id,
        { cursor, limit: 40 },
        requestOptions,
      ),
    !person.merged_into_person_id,
  );
  const residences = useTreePages<
    FamilyTreeResidence,
    FamilyTreeResidencesPage
  >(
    ["residences", person.id],
    (cursor, requestOptions) =>
      apiClient.listFamilyTreeResidences(
        person.id,
        { cursor, limit: 40 },
        requestOptions,
      ),
    !person.merged_into_person_id,
  );
  function reorder(from: number, to: number) {
    const ordered = [...stories.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id);
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    onEdit(
      confirmEditor(
        "Reorder stories",
        `Move this story in ${personName(person)}'s complete story order.`,
        (command, requestOptions) =>
          apiClient.reorderFamilyTreeStories(
            person.id,
            {
              ...command,
              story_ids: ordered,
            },
            requestOptions,
          ),
      ),
    );
  }
  return (
    <>
      <section aria-label="Stories">
        <h3>Stories</h3>
        {runtime.manage ? (
          <Button
            disabled={!editable}
            onClick={() => onEdit(storyEditor(person.id))}
          >
            Add story
          </Button>
        ) : null}
        {stories.isPending && !person.merged_into_person_id ? (
          <p>Loading stories…</p>
        ) : null}
        {stories.error ? (
          <InlineNotice variant="error">
            Could not load stories: {formatApiError(stories.error)}{" "}
            <Button onClick={() => void stories.refetch()}>
              Retry stories
            </Button>
          </InlineNotice>
        ) : null}
        {!stories.consistent ? (
          <InlineNotice variant="error">
            Stories changed while paging.{" "}
            <Button onClick={() => void stories.refresh()}>
              Refresh stories
            </Button>
          </InlineNotice>
        ) : null}
        {!stories.isPending &&
        !stories.error &&
        stories.items.length === 0 &&
        !person.merged_into_person_id ? (
          <p>No stories recorded.</p>
        ) : null}
        {[...stories.items]
          .sort((a, b) => a.position - b.position)
          .map((story, index) => (
            <article key={story.id}>
              <h4>{story.title}</h4>
              <p>{formatDate(story.date)}</p>
              <SafeMarkdown text={story.body_md} />
              <p>
                Source: {story.source_label ?? "unknown"} {story.source_url}
              </p>
              {runtime.manage ? (
                <div>
                  <Button
                    disabled={!editable}
                    onClick={() => onEdit(storyEditor(person.id, story))}
                  >
                    Edit story {story.title}
                  </Button>
                  <Button
                    disabled={!editable}
                    onClick={() =>
                      onEdit(
                        confirmEditor(
                          "Delete story",
                          `Delete the full story “${story.title}” from ${personName(person)}.`,
                          (command, requestOptions) =>
                            apiClient.deleteFamilyTreeStory(
                              story.id,
                              command,
                              requestOptions,
                            ),
                        ),
                      )
                    }
                  >
                    Delete story {story.title}
                  </Button>
                  <Button
                    disabled={
                      !editable ||
                      index === 0 ||
                      stories.hasNextPage ||
                      stories.isFetching
                    }
                    onClick={() => reorder(index, index - 1)}
                  >
                    Move {story.title} up
                  </Button>
                  <Button
                    disabled={
                      !editable ||
                      index === stories.items.length - 1 ||
                      stories.hasNextPage ||
                      stories.isFetching
                    }
                    onClick={() => reorder(index, index + 1)}
                  >
                    Move {story.title} down
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        {stories.hasNextPage ? (
          <Button
            disabled={stories.isFetching}
            onClick={() => void stories.fetchNextPage()}
          >
            Load more stories before reordering
          </Button>
        ) : null}
      </section>
      <section aria-label="Residences">
        <h3>Residence history</h3>
        {runtime.manage ? (
          <Button
            disabled={!editable}
            onClick={() => onEdit(residenceEditor(person.id))}
          >
            Add residence
          </Button>
        ) : null}
        {residences.isPending && !person.merged_into_person_id ? (
          <p>Loading residences…</p>
        ) : null}
        {residences.error ? (
          <InlineNotice variant="error">
            Could not load residences: {formatApiError(residences.error)}{" "}
            <Button onClick={() => void residences.refetch()}>
              Retry residences
            </Button>
          </InlineNotice>
        ) : null}
        {!residences.consistent ? (
          <InlineNotice variant="error">
            Residences changed while paging.{" "}
            <Button onClick={() => void residences.refresh()}>
              Refresh residences
            </Button>
          </InlineNotice>
        ) : null}
        {!residences.isPending &&
        !residences.error &&
        residences.items.length === 0 &&
        !person.merged_into_person_id ? (
          <p>No residences recorded.</p>
        ) : null}
        {residences.items.map((residence) => (
          <article key={residence.id}>
            <h4>
              {residence.place}
              {residence.is_primary ? " · Primary residence" : ""}
            </h4>
            <p>
              {formatDate(residence.start_date)} –{" "}
              {formatDate(residence.end_date)}
            </p>
            <SafeMarkdown text={residence.notes_md} />
            <p>
              {residence.source_label} {residence.source_url}
            </p>
            {runtime.manage ? (
              <>
                <Button
                  disabled={!editable}
                  onClick={() => onEdit(residenceEditor(person.id, residence))}
                >
                  Edit residence {residence.place}
                </Button>
                {!residence.is_primary ? (
                  <Button
                    disabled={!editable}
                    onClick={() =>
                      onEdit(
                        confirmEditor(
                          "Set primary residence",
                          `Set ${residence.place} as the primary residence of ${personName(person)}.`,
                          (command, requestOptions) =>
                            apiClient.patchFamilyTreeResidence(
                              residence.id,
                              {
                                ...command,
                                changes: { is_primary: true },
                              },
                              requestOptions,
                            ),
                        ),
                      )
                    }
                  >
                    Set {residence.place} primary
                  </Button>
                ) : null}
                <Button
                  disabled={!editable}
                  onClick={() =>
                    onEdit(
                      confirmEditor(
                        "Delete residence",
                        `Delete residence ${residence.place} from ${personName(person)}.`,
                        (command, requestOptions) =>
                          apiClient.deleteFamilyTreeResidence(
                            residence.id,
                            command,
                            requestOptions,
                          ),
                      ),
                    )
                  }
                >
                  Delete residence {residence.place}
                </Button>
              </>
            ) : null}
          </article>
        ))}
        {residences.hasNextPage ? (
          <Button
            disabled={residences.isFetching}
            onClick={() => void residences.fetchNextPage()}
          >
            Load more residences
          </Button>
        ) : null}
      </section>
    </>
  );
}
