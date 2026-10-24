import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { apiClient } from "../api/client";
import type * as FT from "@family-manager/family-api/models";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
import { FamilyTreeScreen } from "./FamilyTreeScreen";
const session: FT.AuthSessionResponse = {
  user: {
    id: 1,
    household_id: 27,
    email: "qa@example.test",
    role: "PARENT",
    is_household_owner: false,
  },
};
const grant: FT.FamilyModule = {
  key: "family-tree",
  name: "Family Tree",
  description: "History",
  can_manage: true,
};
const person: FT.FamilyTreePerson = {
  id: 3,
  display_name: "Ada",
  first_name: "Ada",
  middle_name: null,
  last_name: null,
  maiden_name: null,
  suffix: null,
  aliases: [],
  gender: null,
  living_status: "unknown",
  birth_date: null,
  death_date: null,
  birth_place: null,
  death_place: null,
  birth_source: null,
  death_source: null,
  notes_md: "Research",
  source_label: null,
  source_url: null,
  tags: [],
  created_by_user_id: 1,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_locked: false,
  lock_reason: null,
  locked_by_user_id: null,
  locked_at: null,
  archived_at: null,
  merged_into_person_id: null,
  primary_image_asset_id: null,
};
const story: FT.FamilyTreeStory = {
  id: 5,
  person_id: 3,
  title: "School days",
  body_md: "Actual stored story text",
  date: null,
  position: 0,
  created_by_user_id: 1,
  source_label: "Family notebook",
  source_url: null,
};
const residence: FT.FamilyTreeResidence = {
  id: 6,
  person_id: 3,
  place: "London",
  is_primary: false,
  start_date: null,
  end_date: null,
  notes_md: null,
  source_label: null,
  source_url: null,
  created_by_user_id: 1,
};
let revision = 1;
let record = { ...person };
let rows: FT.FamilyTreePerson[] = [];
const requestOptions = expect.objectContaining({
  signal: expect.any(AbortSignal),
});
const affected = {
  person_ids: [3],
  relationship_ids: [],
  story_ids: [],
  residence_ids: [],
  identity_link_ids: [],
  media_asset_ids: [],
  media_reference_ids: [],
};
function setup() {
  revision = 1;
  record = { ...person };
  rows = [];
  jest.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [grant] });
  jest
    .spyOn(apiClient, "getFamilyTreeCollection")
    .mockImplementation(async () => ({
      state: rows.length ? "initialized" : "uninitialized",
      collection_id: rows.length ? 1 : null,
      title: "Family Tree",
      graph_revision: revision,
      default_focus_person_id: null,
      active_people_count: rows.length,
      archived_people_count: 0,
      capabilities: { can_manage: true, can_export: false, can_purge: false },
    }));
  jest
    .spyOn(apiClient, "listFamilyTreePeople")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: rows,
      total: rows.length,
      next_cursor: null,
    }));
  jest.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(async () => ({
    graph_revision: revision,
    focus_person_id: null,
    nodes: [],
    edges: [],
    truncated: false,
    expansion_token: null,
    warnings: [],
    projection_limits: {
      max_nodes: 250,
      max_edges: 500,
      hard_max_nodes: 500,
      hard_max_edges: 1000,
    },
  }));
  jest.spyOn(apiClient, "getFamilyTreePerson").mockImplementation(async () => ({
    graph_revision: revision,
    person: record,
    canonical_person: null,
    parent_links: [],
    care_links: [],
    partner_episodes: [],
    identity_link: null,
  }));
  jest
    .spyOn(apiClient, "listFamilyTreeStories")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: [story],
      next_cursor: null,
    }));
  jest
    .spyOn(apiClient, "listFamilyTreeResidences")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: [residence],
      next_cursor: null,
    }));
  jest
    .spyOn(apiClient, "createFamilyTreePerson")
    .mockImplementation(async (payload) => {
      record = { ...record, ...payload.person } as FT.FamilyTreePerson;
      rows = [record];
      revision++;
      return {
        committed_revision: revision,
        current_revision: revision,
        replayed: false,
        affected,
        warnings: [],
      };
    });
  jest
    .spyOn(apiClient, "patchFamilyTreePerson")
    .mockImplementation(async (_id, payload) => {
      record = { ...record, ...payload.changes } as FT.FamilyTreePerson;
      rows = [record];
      revision++;
      return {
        committed_revision: revision,
        current_revision: revision,
        replayed: false,
        affected,
        warnings: [],
      };
    });
  jest.spyOn(apiClient, "patchFamilyTreeResidence").mockResolvedValue({
    committed_revision: 1,
    current_revision: 1,
    replayed: false,
    affected,
    warnings: [],
  });
  jest.spyOn(apiClient, "listFamilyTreeIdentityCandidates").mockResolvedValue({
    items: [{ kind: "child", id: 8, label: "Mia", active: true }],
  });
  jest.spyOn(apiClient, "linkFamilyTreeIdentity").mockResolvedValue({
    committed_revision: 1,
    current_revision: 1,
    replayed: false,
    affected,
    warnings: [],
  });
}
function mount() {
  return render(
    <FamilyTreeScreen
      session={session}
      modules={[grant]}
      onModulesLoaded={jest.fn()}
    />,
  );
}
async function detail() {
  rows = [record];
  const view = mount();
  fireEvent.press(await screen.findByRole("button", { name: "People" }));
  fireEvent.press(await screen.findByRole("button", { name: "Open Ada (#3)" }, {timeout:5000}));
  await screen.findByRole("button", { name: "Edit person" });
  return view;
}
describe("native family tree screen real core workflows", () => {
  it.each([
    {
      kind: "parent",
      patch: "patchFamilyTreeParentLink",
      remove: "deleteFamilyTreeParentLink",
      key: "parent_links",
      record: { parent_person_id: 4, child_person_id: 3, kind: "biological" },
    },
    {
      kind: "care",
      patch: "patchFamilyTreeCareLink",
      remove: "deleteFamilyTreeCareLink",
      key: "care_links",
      record: {
        caregiver_person_id: 4,
        recipient_person_id: 3,
        kind: "guardian",
        start_date: null,
        end_date: null,
      },
    },
    {
      kind: "partner",
      patch: "patchFamilyTreePartnerEpisode",
      remove: "deleteFamilyTreePartnerEpisode",
      key: "partner_episodes",
      record: {
        person_a_id: 3,
        person_b_id: 4,
        kind: "married",
        status: "ended",
        start_date: null,
        end_date: null,
      },
    },
  ] as const)(
    "edits and confirms deletion of $kind records through the actual native editor",
    async (entry) => {
      const relation = {
        id: 8,
        ...entry.record,
        notes_md: null,
        source_label: null,
        source_url: null,
        created_by_user_id: 1,
      };
      const change = jest.spyOn(apiClient, entry.patch).mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
      const remove = jest.spyOn(apiClient, entry.remove).mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
      jest.mocked(apiClient.getFamilyTreePerson).mockImplementation(
        async () =>
          ({
            graph_revision: revision,
            person: record,
            canonical_person: null,
            parent_links: [],
            care_links: [],
            partner_episodes: [],
            identity_link: null,
            [entry.key]: [relation],
          }) as FT.FamilyTreePersonDetail,
      );
      await detail();
      fireEvent.press(
        screen.getByRole("button", {
          name: `Edit ${entry.kind} relationship #8`,
        }),
      );
      fireEvent.changeText(
        screen.getByLabelText("Source label"),
        "Reviewed citation",
      );
      fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        expect(change).toHaveBeenCalledWith(
          8,
          expect.objectContaining({
            changes: { source_label: "Reviewed citation" },
          }),
          requestOptions,
        ),
      );
      fireEvent.press(
        await screen.findByRole("button", {
          name: `Delete ${entry.kind} relationship #8`,
        }),
      );
      expect(remove).not.toHaveBeenCalled();
      fireEvent.press(
        screen.getByRole("button", {
          name: `Confirm Delete ${entry.kind} relationship #8`,
        }),
      );
      await waitFor(() =>
        expect(remove).toHaveBeenCalledWith(
          8,
          expect.objectContaining({ expected_graph_revision: 1 }),
          requestOptions,
        ),
      );
    },
  );
  it("leaves merged aliases read-only and makes canonical navigation explicit", async () => {
    record = { ...record, merged_into_person_id: 4 };
    await detail();
    expect(
      screen.getByRole("button", { name: "Edit person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(apiClient.patchFamilyTreePerson).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole("button", { name: "Open canonical person #4" }),
    );
    await waitFor(() =>
      expect(apiClient.getFamilyTreePerson).toHaveBeenCalledWith(
        4,
        requestOptions,
      ),
    );
  });
  it("unlinks identities only after specific person confirmation and never calls profile APIs", async () => {
    const unlink = jest
      .spyOn(apiClient, "unlinkFamilyTreeIdentity")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    const children = jest.spyOn(apiClient, "listChildren");
    jest.mocked(apiClient.getFamilyTreePerson).mockImplementation(async () => ({
      graph_revision: revision,
      person: record,
      canonical_person: null,
      parent_links: [],
      care_links: [],
      partner_episodes: [],
      identity_link: {
        id: 10,
        person_id: 3,
        child_id: 8,
        user_id: null,
        active: true,
        label: "Mia",
      },
    }));
    await detail();
    fireEvent.press(
      screen.getByRole("button", { name: "Unlink identity from Ada" }),
    );
    expect(unlink).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm Unlink identity from Ada" }),
    );
    await waitFor(() =>
      expect(unlink).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ expected_graph_revision: 1 }),
        requestOptions,
      ),
    );
    expect(children).not.toHaveBeenCalled();
  });
  it("clears household drafts and content before replacement-scope discovery", async () => {
    const view = await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(
      screen.getByLabelText("Maiden name"),
      "Old household draft",
    );
    const next = { ...session, user: { ...session.user, household_id: 99 } };
    jest.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [] });
    const loaded = jest.fn();
    view.rerender(
      <FamilyTreeScreen
        session={next}
        modules={[grant]}
        onModulesLoaded={loaded}
      />,
    );
    expect(screen.queryByDisplayValue("Old household draft")).toBeNull();
    await waitFor(() => expect(loaded).toHaveBeenCalledWith([]));
    expect(screen.queryByRole("button", { name: "Edit person" })).toBeNull();
  });

  it("preserves the draft through explicit conflict review and shows actual latest facts before reapply", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(
      screen.getByLabelText("Notes (plain text / Markdown)"),
      "Retained draft",
    );
    jest.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce({
      code: "revision_conflict",
      message: "Changed by another manager",
    });
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Changed by another manager");
    record = { ...record, notes_md: "Latest server note" };
    revision = 7;
    fireEvent.press(
      screen.getByRole("button", { name: "Review latest revision" }),
    );
    await screen.findByText("Latest facts for review");
    expect(screen.getByText("Latest server note")).toBeTruthy();
    expect(
      screen.getByLabelText("Notes (plain text / Markdown)").props.value,
    ).toBe("Retained draft");
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    fireEvent.press(
      screen.getByRole("button", { name: "Reapply reviewed draft" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(
      jest.mocked(apiClient.patchFamilyTreePerson).mock.calls[1][1],
    ).toMatchObject({
      expected_graph_revision: 7,
      changes: { notes_md: "Retained draft" },
    });
  });
  it("retains in-memory form draft across a failed authority refresh, then restores it only after success", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(
      screen.getByLabelText("Maiden name"),
      "Retain after discovery error",
    );
    jest.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce({
      code: "revision_conflict",
      message: "Review newest",
    });
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Review newest");
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery unavailable"));
    fireEvent.press(
      screen.getByRole("button", { name: "Review latest revision" }),
    );
    await screen.findByText("Discovery unavailable");
    expect(
      screen.queryByDisplayValue("Retain after discovery error"),
    ).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry Family Tree" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Maiden name").props.value).toBe(
        "Retain after discovery error",
      ),
    );
  });
  it("adds reviewed chronology acknowledgement only after explicit user action", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(
      screen.getByLabelText("Birth date (YYYY / YYYY-MM / YYYY-MM-DD)"),
      "1900",
    );
    fireEvent.press(
      screen.getByRole("checkbox", { name: "Birth date uncertain" }),
    );
    jest.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce({
      code: "chronology_review",
      message: "Review uncertain chronology",
    });
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Review uncertain chronology");
    expect(
      jest.mocked(apiClient.patchFamilyTreePerson).mock.calls[0][1]
        .reviewed_warnings,
    ).toBeUndefined();
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm chronology and save" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(
      jest.mocked(apiClient.patchFamilyTreePerson).mock.calls[1][1]
        .reviewed_warnings,
    ).toEqual(["chronology_review"]);
  });
  it("routes typed existing parent and atomic new partner without inferred relationship or stray direction fields", async () => {
    const create = jest
      .spyOn(apiClient, "createFamilyTreeParentLink")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    await detail();
    rows = [record, { ...person, id: 4, display_name: "Grace" }];
    fireEvent.press(
      screen.getByRole("button", { name: "Add existing parent" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Search relative" }));
    fireEvent.press(await screen.findByRole("button", { name: "Grace (#4)" }));
    fireEvent.press(
      screen.getByRole("radio", { name: "Relationship meaning: adoptive" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_person_id: 4,
          child_person_id: 3,
          kind: "adoptive",
        }),
        requestOptions,
      ),
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty("direction");
    await screen.findByRole("button", { name: "Add new partner" });
    const partner = jest
      .spyOn(apiClient, "createFamilyTreeRelative")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    fireEvent.press(screen.getByRole("button", { name: "Add new partner" }));
    fireEvent.changeText(screen.getByLabelText("Display name"), "Robin");
    fireEvent.press(
      screen.getByRole("radio", { name: "Relationship meaning: partners" }),
    );
    fireEvent.press(
      screen.getByRole("radio", { name: "Partnership status: ended" }),
    );
    fireEvent.changeText(
      screen.getByLabelText("Start date (YYYY / YYYY-MM / YYYY-MM-DD)"),
      "1980-05",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(partner).toHaveBeenCalledWith(
        expect.objectContaining({
          anchor_person_id: 3,
          idempotency_key: expect.any(String),
          person: expect.objectContaining({ display_name: "Robin" }),
          relationship: expect.objectContaining({
            direction: "partner",
            kind: "partners",
            status: "ended",
            start_date: {
              value: "1980-05",
              precision: "month",
              uncertain: false,
            },
          }),
        }),
        requestOptions,
      ),
    );
  });
  it("creates/edits/deletes stories and only reorders a complete loaded order", async () => {
    const create = jest
      .spyOn(apiClient, "createFamilyTreeStory")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    const patch = jest
      .spyOn(apiClient, "patchFamilyTreeStory")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    const remove = jest
      .spyOn(apiClient, "deleteFamilyTreeStory")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    const order = jest
      .spyOn(apiClient, "reorderFamilyTreeStories")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    jest
      .mocked(apiClient.listFamilyTreeStories)
      .mockImplementation(async () => ({
        graph_revision: revision,
        items: [story, { ...story, id: 7, title: "Later years", position: 1 }],
        next_cursor: null,
      }));
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Add story" }));
    fireEvent.changeText(screen.getByLabelText("Story title"), "New story");
    fireEvent.changeText(
      screen.getByLabelText("Story body (plain text / Markdown)"),
      "Stored narrative",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          story: expect.objectContaining({
            title: "New story",
            body_md: "Stored narrative",
          }),
        }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Edit story: School days" }),
    );
    fireEvent.changeText(
      screen.getByLabelText("Story body (plain text / Markdown)"),
      "Changed narrative",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ changes: { body_md: "Changed narrative" } }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", {
        name: "Move story down: School days",
      }),
    );
    await waitFor(() =>
      expect(order).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ story_ids: [7, 5] }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Delete story: School days" }),
    );
    expect(remove).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm Delete story: School days" }),
    );
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ expected_graph_revision: 1 }),
        requestOptions,
      ),
    );
  });
  it("supports complete residence create/edit/delete data and explicit primary selection", async () => {
    const create = jest
      .spyOn(apiClient, "createFamilyTreeResidence")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    const remove = jest
      .spyOn(apiClient, "deleteFamilyTreeResidence")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Add residence" }));
    fireEvent.changeText(screen.getByLabelText("Residence place"), "Paris");
    fireEvent.changeText(
      screen.getByLabelText("Start date (YYYY / YYYY-MM / YYYY-MM-DD)"),
      "2000",
    );
    fireEvent.press(
      screen.getByRole("checkbox", { name: "Start date uncertain" }),
    );
    fireEvent.press(
      screen.getByRole("checkbox", { name: "Primary residence" }),
    );
    fireEvent.changeText(screen.getByLabelText("Source label"), "Letter");
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          residence: expect.objectContaining({
            place: "Paris",
            is_primary: true,
            start_date: { value: "2000", precision: "year", uncertain: true },
            source_label: "Letter",
          }),
        }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Edit residence: London" }),
    );
    fireEvent.changeText(screen.getByLabelText("Residence place"), "Bath");
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(apiClient.patchFamilyTreeResidence).toHaveBeenCalledWith(
        6,
        expect.objectContaining({ changes: { place: "Bath" } }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Delete residence: London" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm Delete residence: London" }),
    );
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(
        6,
        expect.objectContaining({ expected_graph_revision: 1 }),
        requestOptions,
      ),
    );
  });
  it("requires explicit reason/confirmation for manager unlock and archive/restore; never shows purge", async () => {
    record = { ...record, is_locked: true, lock_reason: "Protect source" };
    const unlock = jest
      .spyOn(apiClient, "unlockFamilyTreePerson")
      .mockImplementation(async () => {
        record = { ...record, is_locked: false };
        return {
          committed_revision: 1,
          current_revision: 1,
          replayed: false,
          affected,
          warnings: [],
        };
      });
    const archive = jest
      .spyOn(apiClient, "archiveFamilyTreePerson")
      .mockImplementation(async () => {
        record = { ...record, archived_at: "2026-01-01" };
        return {
          committed_revision: 1,
          current_revision: 1,
          replayed: false,
          affected,
          warnings: [],
        };
      });
    const restore = jest
      .spyOn(apiClient, "restoreFamilyTreePerson")
      .mockResolvedValue({
        committed_revision: 1,
        current_revision: 1,
        replayed: false,
        affected,
        warnings: [],
      });
    await detail();
    expect(
      screen.getByRole("button", { name: "Edit person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /purge/i })).toBeNull();
    fireEvent.changeText(
      screen.getByLabelText("Protection reason"),
      "Reviewed source",
    );
    fireEvent.press(screen.getByRole("button", { name: "Unlock person" }));
    expect(unlock).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Confirm Unlock Ada" }));
    await waitFor(() =>
      expect(unlock).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ reason: "Reviewed source" }),
        requestOptions,
      ),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Archive person" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm Archive Ada" }),
    );
    await waitFor(() => expect(archive).toHaveBeenCalled());
    fireEvent.press(
      await screen.findByRole("button", { name: "Restore person" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm Restore Ada" }),
    );
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ expected_graph_revision: 1 }),
        requestOptions,
      ),
    );
  });
  it("compares bounded typed paths without inventing kinship and keeps view-only reads usable", async () => {
    const compare = jest
      .spyOn(apiClient, "compareFamilyTreePeople")
      .mockResolvedValue({
        graph_revision: 1,
        person_a_id: 3,
        person_b_id: 4,
        state: "connected",
        distance: 1,
        person_ids: [3, 4],
        path: [
          {
            id: "care:9",
            record_id: 9,
            source_person_id: 3,
            target_person_id: 4,
            type: "care",
            kind: "guardian",
            status: null,
            start_date: null,
            end_date: null,
          },
        ],
        warnings: [],
        projection_limits: {
          max_nodes: 500,
          max_edges: 1000,
          hard_max_nodes: 500,
          hard_max_edges: 1000,
        },
      });
    await detail();
    rows = [record, { ...person, id: 4, display_name: "Grace" }];
    fireEvent.press(
      screen.getByRole("button", { name: "Compare connections" }),
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Search compare person" }),
    );
    fireEvent.press(await screen.findByRole("button", { name: "Grace (#4)" }));
    await screen.findByText("Connected by 1 recorded connections");
    expect(compare).toHaveBeenCalledWith(
      expect.objectContaining({ person_a_id: 3, person_b_id: 4 }),
      requestOptions,
    );
    expect(screen.getByText(/care · guardian/)).toBeTruthy();
    expect(screen.queryByText(/grandparent|genetic parent/i)).toBeNull();
  });
  it("uses real server-horizon counts and graph controls to request a bounded server lens", async () => {
    rows = [record];
    jest.mocked(apiClient.getFamilyTreeGraph).mockResolvedValue({
      graph_revision: 1,
      focus_person_id: 3,
      nodes: [
        {
          id: 3,
          display_name: "Ada",
          living_status: "unknown",
          birth_date: null,
          death_date: null,
          is_locked: false,
          expansion_counts: { parents: 1, children: 0, partners: 0, care: 0 },
        },
      ],
      edges: [],
      truncated: false,
      expansion_token: null,
      warnings: [],
      projection_limits: {
        max_nodes: 250,
        max_edges: 500,
        hard_max_nodes: 500,
        hard_max_edges: 1000,
      },
    });
    mount();
    fireEvent.press(
      await screen.findByRole("button", { name: "Expand ancestors of Ada" }),
    );
    await waitFor(() =>
      expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
        expect.objectContaining({
          up_depth: 3,
          down_depth: 2,
          include_history: false,
          include_care: false,
        }),
        requestOptions,
      ),
    );
  });

  beforeEach(setup);
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("renders empty onboarding then creates and reads back first person without sample data", async () => {
    mount();
    expect(await screen.findByText("Start your family tree")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add person" }));
    fireEvent.changeText(screen.getByLabelText("Display name"), "Ada");
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(apiClient.getFamilyTreePerson).toHaveBeenCalledWith(
        3,
        requestOptions,
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Edit person" }),
    ).toBeTruthy();
    expect(apiClient.createFamilyTreePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_graph_revision: 1,
        idempotency_key: expect.any(String),
        person: expect.objectContaining({ display_name: "Ada" }),
      }),
      requestOptions,
    );
  });
  it("never reads genealogy on failed module discovery despite stale shell grants; retry loads", async () => {
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("offline"));
    mount();
    expect(await screen.findByText(/offline/)).toBeTruthy();
    expect(apiClient.getFamilyTreeCollection).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Retry Family Tree" }));
    expect(await screen.findByText("Start your family tree")).toBeTruthy();
  });
  it.each([false, undefined])(
    "keeps unaffirmed manage semantically disabled %s",
    async (can_manage) => {
      rows = [record];
      jest
        .mocked(apiClient.getMyModules)
        .mockResolvedValue({ modules: [{ ...grant, can_manage }] });
      mount();
      await screen.findByText("View-only Family Tree");
      expect(
        screen.getByRole("button", { name: "Add person" }).props
          .accessibilityState.disabled,
      ).toBe(true);
      fireEvent.press(screen.getByRole("button", { name: "Add person" }));
      expect(screen.queryByLabelText("Display name")).toBeNull();
      expect(apiClient.createFamilyTreePerson).not.toHaveBeenCalled();
    },
  );
  it("patches only touched person fields and preserves all draft inputs after a network error", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    expect(screen.getByLabelText("Maiden name")).toBeTruthy();
    expect(screen.getByLabelText("Death source")).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText("Notes (plain text / Markdown)"),
      "Draft note",
    );
    jest
      .mocked(apiClient.patchFamilyTreePerson)
      .mockRejectedValueOnce(new Error("network lost"));
    fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("network lost");
    expect(
      screen.getByLabelText("Notes (plain text / Markdown)").props.value,
    ).toBe("Draft note");
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ changes: { notes_md: "Draft note" } }),
      requestOptions,
    );
    fireEvent.press(
      screen.getByRole("button", { name: "Retry saved command" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(
      jest.mocked(apiClient.patchFamilyTreePerson).mock.calls[1][1]
        .idempotency_key,
    ).toBe(
      jest.mocked(apiClient.patchFamilyTreePerson).mock.calls[0][1]
        .idempotency_key,
    );
  });
  it("reads stories independently of edit controls and updates primary residence through PATCH", async () => {
    await detail();
    fireEvent.press(
      screen.getByRole("button", { name: "Read story: School days" }),
    );
    expect(screen.getByText("Actual stored story text")).toBeTruthy();
    expect(screen.getByText("Family notebook")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Back to person" }));
    fireEvent.press(
      screen.getByRole("button", { name: "Make primary: London" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreeResidence).toHaveBeenCalledWith(
        6,
        expect.objectContaining({ changes: { is_primary: true } }),
        requestOptions,
      ),
    );
  });
  it("requires explicit identity confirmation and uses only module eligible identity projection", async () => {
    await detail();
    fireEvent.press(
      screen.getByRole("button", { name: "Link existing identity" }),
    );
    fireEvent.press(
      await screen.findByRole("button", { name: "Select child: Mia" }),
    );
    expect(apiClient.linkFamilyTreeIdentity).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole("button", { name: "Confirm link Ada to Mia" }),
    );
    await waitFor(() =>
      expect(apiClient.linkFamilyTreeIdentity).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ child_id: 8, confirmed: true }),
        requestOptions,
      ),
    );
  });
  it("clears detail/drafts immediately on authentication generation change", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(screen.getByLabelText("Maiden name"), "Private draft");
    act(() => apiClient.clearAuthentication());
    expect(screen.queryByDisplayValue("Private draft")).toBeNull();
    expect(screen.queryByText("Actual stored story text")).toBeNull();
  });
  it("requires caller-owned discard confirmation for modal close with dirty draft", async () => {
    await detail();
    fireEvent.press(screen.getByRole("button", { name: "Edit person" }));
    fireEvent.changeText(screen.getByLabelText("Maiden name"), "Private draft");
    fireEvent.press(screen.getByRole("button", { name: "Cancel editing" }));
    expect(screen.getByText("Discard unsaved family history?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Maiden name").props.value).toBe(
      "Private draft",
    );
  });
  it("reveals Tree from People without losing the directory search", async () => {
    rows = [record];
    const changed = jest.fn();
    render(<FamilyTreeScreen session={session} modules={[grant]} onModulesLoaded={jest.fn()} onViewChanged={changed} />);
    await screen.findByText("Explore household family history");
    expect(screen.queryByRole("button", { name: "Open Ada (#3)" })).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Search people"), "Ada");
    fireEvent.press(screen.getByRole("button", { name: "Search directory" }));
    fireEvent.press(await screen.findByRole("button", { name: "Show Ada (#3) in tree" }));
    await waitFor(() => expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ focus_person_id: 3 }), expect.anything()));
    expect(screen.getByRole("button", { name: "Tree" }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "People" }));
    expect(screen.getByLabelText("Search people").props.value).toBe("Ada");
    expect(changed).toHaveBeenCalled();
  });

});
