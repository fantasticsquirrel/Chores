import { useDraftState } from "./DraftMemory";
import { Text, View } from "react-native";
import type * as FT from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { formStyles } from "../../../styles/forms";
import { personName } from "../lib/workflows/view";
import type { TreeAction } from "../lib/workflows/commands";
import { NativeEditor, TreeTextField } from "./NativeEditor";
import {
  personFields,
  relativeFields,
  relationshipFields,
  type Direction,
  type Field,
} from "./payload";
export function PeoplePicker({
  people,
  selected,
  onPick,
  label,
  disabled = false,
  onSearch,
  onMore,
}: {
  people: FT.FamilyTreePerson[];
  selected: number | null;
  onPick: (id: number) => void;
  label: string;
  disabled?: boolean;
  onSearch?: (query: string) => void;
  onMore?: () => void;
}) {
  const [query, setQuery] = useDraftState(`picker:${label}:query`, () => "");
  return (
    <View>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      {onSearch ? (
        <>
          <TreeTextField
            label={`${label} search`}
            value={query}
            onChange={setQuery}
            disabled={disabled}
          />
          <ActionButton
            label={`Search ${label.toLowerCase()}`}
            disabled={disabled}
            variant="secondary"
            onPress={() => onSearch(query)}
          />
        </>
      ) : null}
      {people.map((p) => (
        <ActionButton
          key={p.id}
          label={`${selected === p.id ? "Selected: " : ""}${personName(p)} (#${p.id})`}
          disabled={disabled}
          variant="secondary"
          onPress={() => onPick(p.id)}
        />
      ))}
      {onMore ? (
        <ActionButton
          label={`Load more ${label.toLowerCase()}`}
          disabled={disabled}
          variant="secondary"
          onPress={onMore}
        />
      ) : null}
    </View>
  );
}
const prefix = (fields: Field[], p: string) =>
  fields.map((f) => ({
    ...f,
    key: p + f.key,
    label: ["notes_md", "source_label", "source_url"].includes(f.key)
      ? `${p === "person_" ? "Person" : "Relationship"} ${f.label}`
      : f.label,
  }));
function unprefix(data: Record<string, unknown>, prefix: string) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  );
}
export function RelativeEditor({
  direction,
  newPerson,
  personId,
  people,
  disabled,
  onDirty,
  onSubmit,
  onSearch,
  onMore,
}: {
  direction: Direction;
  newPerson: boolean;
  personId: number;
  people: FT.FamilyTreePerson[];
  disabled: boolean;
  onDirty: (v: boolean) => void;
  onSubmit: (a: TreeAction) => Promise<boolean>;
  onSearch: (q: string) => void;
  onMore?: () => void;
}) {
  const [otherId, setOther] = useDraftState<number | null>(
    `relative:${personId}:${direction}:${newPerson}:other`,
    () => null,
  );
  const fields = [
    ...(newPerson ? prefix(personFields, "person_") : []),
    ...prefix(relativeFields(direction), "relationship_"),
  ];
  async function submit(data: Record<string, unknown>) {
    const relationshipData = unprefix(data, "relationship_");
    const relationship = {
      ...relationshipData,
      direction,
    } as FT.FamilyTreeRelativeRelationship;
    if (newPerson)
      return onSubmit({
        type: "createRelative",
        personId,
        person: unprefix(data, "person_") as FT.FamilyTreePersonInput,
        relationship,
      });
    if (otherId === null) throw new Error("Select an existing person.");
    if (direction === "partner")
      return onSubmit({
        type: "createPartner",
        data: {
          ...relationshipData,
          person_a_id: personId,
          person_b_id: otherId,
        } as FT.FamilyTreePartnerData,
      });
    if (direction === "caregiver" || direction === "recipient")
      return onSubmit({
        type: "createCare",
        data: {
          ...relationshipData,
          caregiver_person_id: direction === "caregiver" ? otherId : personId,
          recipient_person_id: direction === "caregiver" ? personId : otherId,
        } as FT.FamilyTreeCareData,
      });
    return onSubmit({
      type: "createParent",
      data: {
        ...relationshipData,
        parent_person_id: direction === "parent" ? otherId : personId,
        child_person_id: direction === "parent" ? personId : otherId,
      } as FT.FamilyTreeParentData,
    });
  }
  return (
    <NativeEditor
      title={`Add ${newPerson ? "new" : "existing"} ${direction}`}
      fields={fields}
      disabled={disabled}
      onDirty={onDirty}
      onSubmit={submit}
    >
      {newPerson ? null : (
        <PeoplePicker
          label="Relative"
          people={people.filter(
            (p) =>
              p.id !== personId && !p.archived_at && !p.merged_into_person_id,
          )}
          selected={otherId}
          onPick={(id) => {
            setOther(id);
            onDirty(true);
          }}
          disabled={disabled}
          onSearch={onSearch}
          onMore={onMore}
        />
      )}
    </NativeEditor>
  );
}
export function RelationshipEditor({
  type,
  record,
  people,
  disabled,
  onDirty,
  onSubmit,
  onSearch,
  onMore,
}: {
  type: "parent" | "care" | "partner";
  record:
    | FT.FamilyTreeParentLink
    | FT.FamilyTreeCareLink
    | FT.FamilyTreePartnerEpisode;
  people: FT.FamilyTreePerson[];
  disabled: boolean;
  onDirty: (v: boolean) => void;
  onSubmit: (a: TreeAction) => Promise<boolean>;
  onSearch: (q: string) => void;
  onMore?: () => void;
}) {
  const first =
    type === "parent"
      ? "parent_person_id"
      : type === "care"
        ? "caregiver_person_id"
        : "person_a_id";
  const second =
    type === "parent"
      ? "child_person_id"
      : type === "care"
        ? "recipient_person_id"
        : "person_b_id";
  const source = record as unknown as Record<string, unknown>;
  const [a, setA] = useDraftState(`relationship:${type}:${record.id}:a`, () =>
      Number(source[first]),
    ),
    [b, setB] = useDraftState(`relationship:${type}:${record.id}:b`, () =>
      Number(source[second]),
    );
  async function submit(data: Record<string, unknown>) {
    if (a === b) throw new Error("A relationship needs two different people.");
    const changes = {
      ...data,
      ...(a !== source[first] ? { [first]: a } : {}),
      ...(b !== source[second] ? { [second]: b } : {}),
    };
    return onSubmit({
      type:
        type === "parent"
          ? "patchParent"
          : type === "care"
            ? "patchCare"
            : "patchPartner",
      id: record.id,
      changes,
    });
  }
  return (
    <NativeEditor
      title={`Edit ${type} relationship #${record.id}`}
      fields={relationshipFields(type)}
      initial={record}
      patch
      externallyDirty={a !== source[first] || b !== source[second]}
      disabled={disabled}
      onDirty={onDirty}
      onSubmit={submit}
    >
      <PeoplePicker
        label={first.replace(/_/g, " ")}
        people={people.filter(
          (p) => !p.archived_at && !p.merged_into_person_id,
        )}
        selected={a}
        onPick={(id) => {
          setA(id);
          onDirty(true);
        }}
        disabled={disabled}
        onSearch={onSearch}
        onMore={onMore}
      />
      <PeoplePicker
        label={second.replace(/_/g, " ")}
        people={people.filter(
          (p) => !p.archived_at && !p.merged_into_person_id,
        )}
        selected={b}
        onPick={(id) => {
          setB(id);
          onDirty(true);
        }}
        disabled={disabled}
      />
    </NativeEditor>
  );
}
