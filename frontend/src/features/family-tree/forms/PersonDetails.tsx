import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreePersonDetail,
} from "../../../api";
import { Button, Card, InlineNotice } from "../../../ui";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { personName } from "../lib/workflows/workflows";
import {
  confirmEditor,
  lockEditor,
  personEditor,
  type EditorSpec,
} from "../lib/workflows/editors";
import { SafeMarkdown } from "./SafeMarkdown";
import { personFieldsRead } from "../lib/workflows/personPresentation";
import { PersonRelationships } from "./PersonRelationships";
import { PersonMedia } from "./PersonMedia";
import { PersonNarratives } from "./PersonNarratives";
export { RelativeChooser, IdentityChooser } from "./PersonChoosers";
export function PersonDetails({
  detail,
  people,
  onEdit: requestEdit,
  onRelative,
  onIdentity,
  onSelect,
  onFocus,
}: {
  detail: FamilyTreePersonDetail;
  people: FamilyTreePerson[];
  onEdit: (spec: EditorSpec) => void;
  onRelative: () => void;
  onIdentity: () => void;
  onSelect: (id: number) => void;
  onFocus: (id: number) => void;
}) {
  const runtime = useTreeRuntime(),
    person = detail.person;
  const onEdit = (spec: EditorSpec) =>
    requestEdit({
      ...spec,
      originRevision: detail.graph_revision,
      reviewFacts: spec.reviewFacts ?? { ...person },
      reviewTarget: spec.reviewTarget ?? { entity: "person", id: person.id },
    });
  const editable =
    runtime.manage &&
    runtime.online &&
    !runtime.busy &&
    detail.graph_revision >= runtime.floor.current &&
    !person.is_locked &&
    !person.archived_at &&
    !person.merged_into_person_id;
  const choices = [
    ...new Map(
      [
        ...people,
        person,
        ...(detail.canonical_person ? [detail.canonical_person] : []),
      ].map((item) => [
        item.id,
        { id: item.id, label: `${personName(item)} (person ${item.id})` },
      ]),
    ).values(),
  ];
  // Include current endpoints even when a directory filter excludes them. IDs
  // remain explicit, never replaced with an inferred name or another household.
  for (const link of detail.parent_links) {
    for (const id of [link.parent_person_id, link.child_person_id])
      if (!choices.some((choice) => choice.id === id))
        choices.push({ id, label: `Recorded person ${id}` });
  }
  for (const link of detail.care_links) {
    for (const id of [link.caregiver_person_id, link.recipient_person_id])
      if (!choices.some((choice) => choice.id === id))
        choices.push({ id, label: `Recorded person ${id}` });
  }
  for (const link of detail.partner_episodes) {
    for (const id of [link.person_a_id, link.person_b_id])
      if (!choices.some((choice) => choice.id === id))
        choices.push({ id, label: `Recorded person ${id}` });
  }
  return (
    <Card as="section" aria-label={`Person details: ${personName(person)}`}>
      <h2>{personName(person)}</h2>
      <p>
        Person {person.id} · {person.living_status} · revision{" "}
        {detail.graph_revision}
      </p>
      <Button
        onClick={() => onFocus(person.id)}
        disabled={!!person.merged_into_person_id}
      >
        Focus tree on {personName(person)}
      </Button>
      {person.merged_into_person_id ? (
        <InlineNotice variant="info">
          This is an alias record. It cannot be edited. Canonical person:{" "}
          {detail.canonical_person
            ? personName(detail.canonical_person)
            : person.merged_into_person_id}
          .{" "}
          <Button onClick={() => onSelect(person.merged_into_person_id!)}>
            Open canonical person
          </Button>
        </InlineNotice>
      ) : null}
      {person.is_locked ? (
        <InlineNotice variant="info">
          Locked: {person.lock_reason}. Editing and attached-record changes are
          unavailable.
        </InlineNotice>
      ) : null}
      {person.archived_at ? (
        <InlineNotice variant="info">
          Archived person. Restore explicitly before editing.
        </InlineNotice>
      ) : null}
      <dl>
        {[...personFieldsRead(person)].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <SafeMarkdown text={person.notes_md} />
      {runtime.manage && !person.merged_into_person_id ? (
        <div className="quick-actions">
          <Button
            disabled={!editable}
            onClick={() => onEdit(personEditor(person))}
          >
            Edit person
          </Button>
          <Button disabled={!editable} onClick={onRelative}>
            Add relative or relationship
          </Button>
          <Button
            disabled={!runtime.online || runtime.busy || !!person.archived_at}
            onClick={() => onEdit(lockEditor(person))}
          >
            {person.is_locked ? "Unlock person" : "Lock person"}
          </Button>
          <Button
            disabled={!runtime.online || runtime.busy || person.is_locked}
            onClick={() =>
              onEdit(
                confirmEditor(
                  person.archived_at ? "Restore person" : "Archive person",
                  `${person.archived_at ? "Restore" : "Archive"} ${personName(person)}. Stories and relationships are retained.`,
                  (command, requestOptions) =>
                    person.archived_at
                      ? apiClient.restoreFamilyTreePerson(
                          person.id,
                          command,
                          requestOptions,
                        )
                      : apiClient.archiveFamilyTreePerson(
                          person.id,
                          command,
                          requestOptions,
                        ),
                ),
              )
            }
          >
            {person.archived_at ? "Restore person" : "Archive person"}
          </Button>
        </div>
      ) : null}
      <PersonRelationships
        detail={detail}
        choices={choices}
        editable={editable}
        onEdit={onEdit}
        onSelect={onSelect}
      />
      {!person.merged_into_person_id ? (
        <>
          <PersonNarratives
            person={person}
            originRevision={detail.graph_revision}
            editable={editable}
            onEdit={requestEdit}
          />
          <PersonMedia
            key={person.id}
            person={person}
            originRevision={detail.graph_revision}
            onEdit={requestEdit}
          />
        </>
      ) : null}
      <section aria-label="Identity association">
        <h3>Identity association</h3>
        <p>
          {detail.identity_link
            ? `${detail.identity_link.label}${detail.identity_link.active ? "" : " (inactive)"}`
            : "No account or child identity linked. Genealogy people do not automatically create sign-in accounts."}
        </p>
        {runtime.manage && !person.merged_into_person_id ? (
          <>
            <Button disabled={!editable} onClick={onIdentity}>
              Choose identity to link
            </Button>
            {detail.identity_link ? (
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(
                    confirmEditor(
                      "Unlink identity",
                      `Unlink ${detail.identity_link!.label} from ${personName(person)}. The account and genealogy person remain unchanged.`,
                      (command, requestOptions) =>
                        apiClient.unlinkFamilyTreeIdentity(
                          person.id,
                          command,
                          requestOptions,
                        ),
                    ),
                  )
                }
              >
                Unlink identity
              </Button>
            ) : null}
          </>
        ) : null}
      </section>
    </Card>
  );
}
