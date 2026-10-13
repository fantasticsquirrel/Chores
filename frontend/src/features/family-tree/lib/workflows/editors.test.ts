import { describe, it, expect, vi, afterEach } from "vitest";
import { apiClient } from "../../../../api";
import {
  personEditor,
  storyEditor,
  residenceEditor,
  relativeEditor,
  relationshipEditor,
  identityEditor,
  lockEditor,
} from "./editors";
import { person, mutation } from "../../forms/testFixtures";
const options = { signal: new AbortController().signal };
const command = {
  expected_graph_revision: 7,
  idempotency_key: "opaque-attempt-key",
};
afterEach(() => vi.restoreAllMocks());
describe("Real FT2 editor command mapping", () => {
  it("keeps new-relative relationship evidence separate from the new person's sources", () => {
    const editor = relativeEditor(person(), "parent");
    expect(editor.fields.map((field) => field.label)).toContain(
      "Relationship source label",
    );
    expect(editor.fields.map((field) => field.label)).toContain("Source label");
  });
  it("creates person with required idempotency and no readonly metadata", async () => {
    const spy = vi
      .spyOn(apiClient, "createFamilyTreePerson")
      .mockResolvedValue(mutation());
    await personEditor().operation({ first_name: "New" })(command, options);
    expect(spy).toHaveBeenCalledWith(
      {
        ...command,
        person: { first_name: "New" },
      },
      options,
    );
  });
  it.each(["parent", "child", "caregiver", "recipient", "partner"] as const)(
    "links existing %s with explicit typed endpoints",
    async (direction) => {
      const parent = vi
          .spyOn(apiClient, "createFamilyTreeParentLink")
          .mockResolvedValue(mutation()),
        care = vi
          .spyOn(apiClient, "createFamilyTreeCareLink")
          .mockResolvedValue(mutation()),
        partner = vi
          .spyOn(apiClient, "createFamilyTreePartnerEpisode")
          .mockResolvedValue(mutation());
      await relativeEditor(person(1), direction, person(2)).operation({
        kind:
          direction === "caregiver" || direction === "recipient"
            ? "guardian"
            : direction === "partner"
              ? "married"
              : "adoptive",
        status: "ended",
      })(command, options);
      if (direction === "parent" || direction === "child")
        expect(parent.mock.calls[0][0]).toMatchObject({
          parent_person_id: direction === "parent" ? 2 : 1,
          child_person_id: direction === "child" ? 2 : 1,
          kind: "adoptive",
          ...command,
        });
      else if (direction === "caregiver" || direction === "recipient")
        expect(care.mock.calls[0][0]).toMatchObject({
          caregiver_person_id: direction === "caregiver" ? 2 : 1,
          recipient_person_id: direction === "recipient" ? 2 : 1,
          kind: "guardian",
          ...command,
        });
      else
        expect(partner.mock.calls[0][0]).toMatchObject({
          person_a_id: 1,
          person_b_id: 2,
          kind: "married",
          status: "ended",
          ...command,
        });
      const payload =
        direction === "parent" || direction === "child"
          ? parent.mock.calls[0][0]
          : direction === "caregiver" || direction === "recipient"
            ? care.mock.calls[0][0]
            : partner.mock.calls[0][0];
      expect(payload).not.toHaveProperty("direction");
      if (direction !== "partner") expect(payload).not.toHaveProperty("status");
    },
  );
  it.each(["parent", "child", "caregiver", "recipient", "partner"] as const)(
    "creates atomic new %s through the real compound method",
    async (direction) => {
      const spy = vi
        .spyOn(apiClient, "createFamilyTreeRelative")
        .mockResolvedValue(mutation());
      const kind =
        direction === "caregiver" || direction === "recipient"
          ? "guardian"
          : "unknown";
      await relativeEditor(person(5), direction).operation({
        first_name: "New relative",
        kind,
        relationship_source_label: "Relationship source",
        source_label: "Person source",
      })(command, options);
      expect(spy.mock.calls[0][0]).toEqual({
        ...command,
        anchor_person_id: 5,
        person: { first_name: "New relative", source_label: "Person source" },
        relationship: {
          direction,
          kind,
          source_label: "Relationship source",
        },
      });
    },
  );
  it.each(["parent", "care", "partner"] as const)(
    "patches %s relationship using only touched changes",
    async (type) => {
      const p = vi
          .spyOn(apiClient, "patchFamilyTreeParentLink")
          .mockResolvedValue(mutation()),
        c = vi
          .spyOn(apiClient, "patchFamilyTreeCareLink")
          .mockResolvedValue(mutation()),
        e = vi
          .spyOn(apiClient, "patchFamilyTreePartnerEpisode")
          .mockResolvedValue(mutation());
      const base = {
        id: 3,
        created_by_user_id: 1,
        source_label: null,
        source_url: null,
        notes_md: null,
      };
      const record =
        type === "parent"
          ? {
              ...base,
              parent_person_id: 1,
              child_person_id: 2,
              kind: "adoptive" as const,
            }
          : type === "care"
            ? {
                ...base,
                caregiver_person_id: 1,
                recipient_person_id: 2,
                kind: "guardian" as const,
                start_date: null,
                end_date: null,
              }
            : {
                ...base,
                person_a_id: 1,
                person_b_id: 2,
                kind: "married" as const,
                status: "ended" as const,
                start_date: null,
                end_date: null,
              };
      await relationshipEditor(type, record, []).operation({ notes_md: null })(
        command,
        options,
      );
      expect(
        type === "parent" ? p : type === "care" ? c : e,
      ).toHaveBeenCalledWith(
        3,
        { ...command, changes: { notes_md: null } },
        options,
      );
    },
  );
  it("story creation and patch keep full text/date/source semantics", async () => {
    const create = vi
        .spyOn(apiClient, "createFamilyTreeStory")
        .mockResolvedValue(mutation()),
      patch = vi
        .spyOn(apiClient, "patchFamilyTreeStory")
        .mockResolvedValue(mutation());
    await storyEditor(1).operation({
      title: "Title",
      body_md: "Full\n\nstory",
      date: null,
      source_label: "Book",
    })(command, options);
    expect(create).toHaveBeenCalledWith(
      1,
      {
        ...command,
        story: {
          title: "Title",
          body_md: "Full\n\nstory",
          date: null,
          source_label: "Book",
        },
      },
      options,
    );
    await storyEditor(1, {
      id: 2,
      person_id: 1,
      title: "Title",
      body_md: "Full",
      date: null,
      source_label: "Book",
      source_url: null,
      position: 0,
      created_by_user_id: 1,
    }).operation({ source_label: null })(command, options);
    expect(patch).toHaveBeenCalledWith(
      2,
      {
        ...command,
        changes: { source_label: null },
      },
      options,
    );
  });
  it("residence create and patch preserve primary/dates/citation and null clears", async () => {
    const create = vi
        .spyOn(apiClient, "createFamilyTreeResidence")
        .mockResolvedValue(mutation()),
      patch = vi
        .spyOn(apiClient, "patchFamilyTreeResidence")
        .mockResolvedValue(mutation());
    await residenceEditor(1).operation({
      place: "Town",
      is_primary: true,
      start_date: { value: "1980", uncertain: true },
    })(command, options);
    expect(create).toHaveBeenCalledWith(
      1,
      {
        ...command,
        residence: {
          place: "Town",
          is_primary: true,
          start_date: { value: "1980", uncertain: true },
        },
      },
      options,
    );
    await residenceEditor(1, {
      id: 2,
      person_id: 1,
      place: "Town",
      is_primary: true,
      start_date: null,
      end_date: null,
      notes_md: null,
      source_label: null,
      source_url: null,
      created_by_user_id: 1,
    }).operation({ end_date: null })(command, options);
    expect(patch).toHaveBeenCalledWith(
      2,
      {
        ...command,
        changes: { end_date: null },
      },
      options,
    );
  });
  it.each(["user", "child"] as const)(
    "requires explicit exactly-one %s identity association",
    async (kind) => {
      const spy = vi
        .spyOn(apiClient, "linkFamilyTreeIdentity")
        .mockResolvedValue(mutation());
      const editor = identityEditor(person(4), {
        kind,
        id: 8,
        label: "Existing identity",
        active: true,
      });
      expect(editor.confirmation).toContain("does not create an account");
      await editor.operation({})(command, options);
      expect(spy).toHaveBeenCalledWith(
        4,
        {
          ...command,
          confirmed: true,
          ...(kind === "user" ? { user_id: 8 } : { child_id: 8 }),
        },
        options,
      );
    },
  );
  it("lock and unlock both require reasons and versioned commands", async () => {
    const lock = vi
        .spyOn(apiClient, "lockFamilyTreePerson")
        .mockResolvedValue(mutation()),
      unlock = vi
        .spyOn(apiClient, "unlockFamilyTreePerson")
        .mockResolvedValue(mutation());
    await lockEditor(person()).operation({ reason: "Reviewing records" })(
      command,
      options,
    );
    await lockEditor({ ...person(), is_locked: true }).operation({
      reason: "Review complete",
    })(command, options);
    expect(lock).toHaveBeenCalledWith(
      1,
      {
        ...command,
        reason: "Reviewing records",
      },
      options,
    );
    expect(unlock).toHaveBeenCalledWith(
      1,
      {
        ...command,
        reason: "Review complete",
      },
      options,
    );
  });
});
