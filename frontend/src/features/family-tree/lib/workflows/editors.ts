import type {
  FamilyTreePerson,
  FamilyTreeParentLink,
  FamilyTreeCareLink,
  FamilyTreePartnerEpisode,
  FamilyTreeStory,
  FamilyTreeResidence,
  FamilyTreeIdentityCandidate,
  FamilyTreeCommand,
  FamilyTreeParentData,
  FamilyTreeCareData,
  FamilyTreePartnerData,
  FamilyTreeRelativeRelationship,
  FamilyTreePersonInput,
  FamilyTreeStoryInput,
  FamilyTreeResidenceInput,
} from "../../../../api";
import { apiClient } from "../../../../api";
import {
  personFields,
  storyFields,
  residenceFields,
  citationFields,
  dateFields,
  type Field,
} from "./fields";
import { personFacts, personName, type Facts } from "./workflows";
import type { TreeOperation } from "../../hooks/useTreeCommand";
import type { ReviewTarget } from "./review";

export type EditorSpec = {
  title: string;
  fields: Field[];
  initial: Facts;
  latest?: Facts;
  reviewTarget?: ReviewTarget;
  create?: boolean;
  operation: (facts: Facts) => TreeOperation;
  confirmation?: string;
  saveLabel?: string;
  focusCreated?: boolean;
};
const parentKinds = ["biological", "adoptive", "step", "unknown"] as const,
  careKinds = ["guardian", "caregiver"] as const,
  partnerKinds = ["married", "civil_union", "partners", "unknown"] as const;
const status: Field = {
  key: "status",
  label: "Partnership status",
  type: "select",
  options: ["current", "separated", "ended", "unknown"],
};
export function personEditor(person?: FamilyTreePerson): EditorSpec {
  return {
    title: person
      ? `Edit ${personName(person)}`
      : "Add first or disconnected person",
    reviewTarget: person ? { entity: "person", id: person.id } : undefined,
    fields: personFields,
    initial: { ...personFacts(person) },
    create: !person,
    focusCreated: !person,
    operation: (facts) => (command, requestOptions) =>
      person
        ? apiClient.patchFamilyTreePerson(
            person.id,
            {
              ...command,
              changes: facts as FamilyTreePersonInput,
            },
            requestOptions,
          )
        : apiClient.createFamilyTreePerson(
            {
              ...command,
              idempotency_key: command.idempotency_key!,
              person: facts as FamilyTreePersonInput,
            },
            requestOptions,
          ),
  };
}
export function storyEditor(
  personId: number,
  story?: FamilyTreeStory,
): EditorSpec {
  const initial = story
    ? {
        title: story.title,
        body_md: story.body_md,
        date: story.date,
        source_label: story.source_label,
        source_url: story.source_url,
      }
    : { title: "", body_md: "" };
  return {
    title: story ? `Edit story: ${story.title}` : "Add story",
    reviewTarget: story ? { entity: "story", id: story.id } : undefined,
    fields: storyFields,
    initial,
    create: !story,
    operation: (facts) => (command, requestOptions) =>
      story
        ? apiClient.patchFamilyTreeStory(
            story.id,
            {
              ...command,
              changes: facts,
            },
            requestOptions,
          )
        : apiClient.createFamilyTreeStory(
            personId,
            {
              ...command,
              idempotency_key: command.idempotency_key!,
              story: facts as unknown as FamilyTreeStoryInput,
            },
            requestOptions,
          ),
  };
}
export function residenceEditor(
  personId: number,
  residence?: FamilyTreeResidence,
): EditorSpec {
  return {
    title: residence ? `Edit residence: ${residence.place}` : "Add residence",
    reviewTarget: residence
      ? { entity: "residence", id: residence.id }
      : undefined,
    fields: residenceFields,
    initial: residence
      ? {
          place: residence.place,
          is_primary: residence.is_primary,
          start_date: residence.start_date,
          end_date: residence.end_date,
          notes_md: residence.notes_md,
          source_label: residence.source_label,
          source_url: residence.source_url,
        }
      : { place: "", is_primary: false },
    create: !residence,
    operation: (facts) => (command, requestOptions) =>
      residence
        ? apiClient.patchFamilyTreeResidence(
            residence.id,
            {
              ...command,
              changes: facts,
            },
            requestOptions,
          )
        : apiClient.createFamilyTreeResidence(
            personId,
            {
              ...command,
              residence: facts as unknown as FamilyTreeResidenceInput,
            },
            requestOptions,
          ),
  };
}
export function relationshipEditor(
  type: "parent" | "care" | "partner",
  record: FamilyTreeParentLink | FamilyTreeCareLink | FamilyTreePartnerEpisode,
  choices: readonly { id: number; label: string }[],
): EditorSpec {
  const endpointFields: Field[] =
    type === "parent"
      ? [
          { key: "parent_person_id", label: "Parent", type: "person", choices },
          { key: "child_person_id", label: "Child", type: "person", choices },
        ]
      : type === "care"
        ? [
            {
              key: "caregiver_person_id",
              label: "Caregiver",
              type: "person",
              choices,
            },
            {
              key: "recipient_person_id",
              label: "Recipient",
              type: "person",
              choices,
            },
          ]
        : [
            {
              key: "person_a_id",
              label: "First partner",
              type: "person",
              choices,
            },
            {
              key: "person_b_id",
              label: "Second partner",
              type: "person",
              choices,
            },
          ];
  const fields = [
    ...endpointFields,
    {
      key: "kind",
      label: "Recorded relationship kind",
      type: "select" as const,
      options:
        type === "parent"
          ? parentKinds
          : type === "care"
            ? careKinds
            : partnerKinds,
    },
    ...(type === "partner" ? [status] : []),
    ...(type !== "parent" ? dateFields : []),
    ...citationFields,
  ];
  const initial = Object.fromEntries(
    fields.map((field) => [field.key, (record as unknown as Facts)[field.key]]),
  );
  return {
    title: `Edit recorded ${type} relationship ${record.id}`,
    reviewTarget: { entity: type, id: record.id },
    fields,
    initial,
    operation: (facts) => (command, requestOptions) =>
      type === "parent"
        ? apiClient.patchFamilyTreeParentLink(
            record.id,
            {
              ...command,
              changes: facts,
            },
            requestOptions,
          )
        : type === "care"
          ? apiClient.patchFamilyTreeCareLink(
              record.id,
              {
                ...command,
                changes: facts,
              },
              requestOptions,
            )
          : apiClient.patchFamilyTreePartnerEpisode(
              record.id,
              {
                ...command,
                changes: facts,
              },
              requestOptions,
            ),
  };
}
export function relativeEditor(
  anchor: FamilyTreePerson,
  direction: FamilyTreeRelativeRelationship["direction"],
  existing?: FamilyTreePerson,
): EditorSpec {
  const isParent = direction === "parent" || direction === "child",
    isCare = direction === "caregiver" || direction === "recipient";
  const relationshipFields: Field[] = [
    {
      key: "kind",
      label: "Recorded relationship kind",
      type: "select",
      options: isParent ? parentKinds : isCare ? careKinds : partnerKinds,
    },
    ...(!isParent ? dateFields : []),
    ...(direction === "partner" ? [status] : []),
    ...citationFields.map((field) => ({
      ...field,
      key: `relationship_${field.key}`,
      label: `Relationship ${field.label.toLowerCase()}`,
    })),
  ];
  const initial = {
    ...(!existing ? personFacts() : {}),
    kind: isParent ? "unknown" : isCare ? "caregiver" : "unknown",
    ...(direction === "partner" ? { status: "unknown" } : {}),
  };
  return {
    title: `Add ${existing ? personName(existing) : "new person"} as ${direction} of ${personName(anchor)}`,
    fields: [...relationshipFields, ...(!existing ? personFields : [])],
    initial,
    create: true,
    focusCreated: !existing,
    operation: (facts) => (command, requestOptions) => {
      const relationship = {
        direction,
        kind: facts.kind,
        ...Object.fromEntries(
          [...dateFields, status]
            .filter((field) => field.key in facts)
            .map((field) => [field.key, facts[field.key]]),
        ),
        ...Object.fromEntries(
          citationFields
            .filter((field) => `relationship_${field.key}` in facts)
            .map((field) => [field.key, facts[`relationship_${field.key}`]]),
        ),
      } as FamilyTreeRelativeRelationship;
      if (!existing) {
        const person = Object.fromEntries(
          personFields
            .filter((field) => field.key in facts)
            .map((field) => [field.key, facts[field.key]]),
        ) as FamilyTreePersonInput;
        return apiClient.createFamilyTreeRelative(
          {
            ...command,
            idempotency_key: command.idempotency_key!,
            anchor_person_id: anchor.id,
            relationship,
            person,
          },
          requestOptions,
        );
      }
      const relationshipData = Object.fromEntries(
        Object.entries(relationship).filter(
          ([key]) =>
            key !== "direction" &&
            (key !== "status" || direction === "partner") &&
            (!isParent || (key !== "start_date" && key !== "end_date")),
        ),
      );
      if (isParent) {
        const data = {
          ...relationshipData,
          parent_person_id: direction === "parent" ? existing.id : anchor.id,
          child_person_id: direction === "child" ? existing.id : anchor.id,
        };
        return apiClient.createFamilyTreeParentLink(
          {
            ...command,
            ...data,
          } as FamilyTreeCommand & FamilyTreeParentData,
          requestOptions,
        );
      }
      if (isCare) {
        const data = {
          ...relationshipData,
          caregiver_person_id:
            direction === "caregiver" ? existing.id : anchor.id,
          recipient_person_id:
            direction === "recipient" ? existing.id : anchor.id,
        };
        return apiClient.createFamilyTreeCareLink(
          {
            ...command,
            ...data,
          } as FamilyTreeCommand & FamilyTreeCareData,
          requestOptions,
        );
      }
      return apiClient.createFamilyTreePartnerEpisode(
        {
          ...command,
          ...relationshipData,
          person_a_id: anchor.id,
          person_b_id: existing.id,
        } as FamilyTreeCommand & FamilyTreePartnerData,
        requestOptions,
      );
    },
  };
}
export function confirmEditor(
  title: string,
  confirmation: string,
  operation: TreeOperation,
): EditorSpec {
  return {
    title,
    fields: [],
    initial: {},
    confirmation,
    operation: () => operation,
    saveLabel: "Confirm change",
  };
}
export function identityEditor(
  person: FamilyTreePerson,
  candidate: FamilyTreeIdentityCandidate,
): EditorSpec {
  return confirmEditor(
    `Link identity to ${personName(person)}`,
    `Associate ${personName(person)} with ${candidate.kind}: ${candidate.label}${candidate.active ? "" : " (inactive)"}. This does not create an account, change access, or infer relationships.`,
    (command, requestOptions) =>
      apiClient.linkFamilyTreeIdentity(
        person.id,
        {
          ...command,
          confirmed: true,
          ...(candidate.kind === "user"
            ? { user_id: candidate.id }
            : { child_id: candidate.id }),
        },
        requestOptions,
      ),
  );
}
export function lockEditor(person: FamilyTreePerson): EditorSpec {
  const unlock = person.is_locked;
  return {
    title: `${unlock ? "Unlock" : "Lock"} ${personName(person)}`,
    fields: [
      {
        key: "reason",
        label: `Reason to ${unlock ? "unlock" : "lock"}`,
        required: true,
      },
    ],
    initial: { reason: "" },
    create: true,
    confirmation: unlock
      ? "Unlock permits authorized edits again. The reason is recorded."
      : "Lock protects this person and attached records from editing until an authorized manager explicitly unlocks.",
    operation: (facts) => (command, requestOptions) =>
      unlock
        ? apiClient.unlockFamilyTreePerson(
            person.id,
            {
              ...command,
              reason: String(facts.reason),
            },
            requestOptions,
          )
        : apiClient.lockFamilyTreePerson(
            person.id,
            {
              ...command,
              reason: String(facts.reason),
            },
            requestOptions,
          ),
  };
}
