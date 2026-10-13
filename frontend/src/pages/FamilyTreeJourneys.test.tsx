import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { onlineManager } from "@tanstack/react-query";
import { FamilyTreePage } from "./FamilyTreePage";
import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreeStory,
  type FamilyTreeResidence,
  type FamilyTreePersonDetail,
  type FamilyTreeCommand,
} from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import {
  adult,
  collection,
  detail,
  graph,
  mutation,
  person,
} from "../features/family-tree/forms/testFixtures";
let revision: number,
  people: FamilyTreePerson[],
  stories: FamilyTreeStory[],
  residences: FamilyTreeResidence[],
  links: Pick<
    FamilyTreePersonDetail,
    "parent_links" | "care_links" | "partner_episodes" | "identity_link"
  >;
function commit(command: FamilyTreeCommand, ids = [1]) {
  expect(command.expected_graph_revision).toBe(revision);
  expect(command.idempotency_key).toBeTruthy();
  revision++;
  return mutation(revision, ids);
}
function mount(path = "/family-tree/people/1", manage = true) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: adult,
    moduleKeys: ["family-tree"],
    manageableModuleKeys: manage ? ["family-tree"] : [],
    setAuthenticatedSession: vi.fn(),
    clearSession: vi.fn(),
    logout: vi.fn(),
    refreshModuleAccess: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/family-tree" element={<FamilyTreePage />} />
          <Route
            path="/family-tree/people/:personId"
            element={<FamilyTreePage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
async function open(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
  return within(screen.getByRole("dialog"));
}
async function saveDialog(confirm = false) {
  const dialog = within(screen.getByRole("dialog"));
  if (confirm)
    fireEvent.click(dialog.getByLabelText("I confirm this specific change."));
  fireEvent.click(
    dialog.getByRole("button", {
      name: confirm ? "Confirm change" : "Save changes",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
}
beforeEach(() => {
  vi.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
  onlineManager.setOnline(true);
  revision = 1;
  people = [person(1, "Alex"), person(2, "Disconnected")];
  stories = [];
  residences = [];
  links = {
    parent_links: [],
    care_links: [],
    partner_episodes: [],
    identity_link: null,
  };
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [{ key: "family-tree", can_manage: true }],
  } as Awaited<ReturnType<typeof apiClient.getMyModules>>);
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockImplementation(
    async () => ({
      ...collection(revision, people.filter((p) => !p.archived_at).length),
      default_focus_person_id: people.find((p) => !p.archived_at)?.id ?? null,
    }),
  );
  vi.spyOn(apiClient, "listFamilyTreePeople").mockImplementation(
    async (params = {}) => {
      const items = people.filter(
        (p) =>
          !!p.archived_at === !!params.archived &&
          (!params.query ||
            p.display_name?.toLowerCase().includes(params.query.toLowerCase())),
      );
      return {
        graph_revision: revision,
        items,
        total: items.length,
        next_cursor: null,
      };
    },
  );
  vi.spyOn(apiClient, "getFamilyTreePerson").mockImplementation(async (id) => ({
    ...detail(people.find((p) => p.id === id)!, revision),
    ...links,
  }));
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(
    async (params) => ({
      ...graph(
        people.filter((p) => !p.archived_at),
        revision,
      ),
      focus_person_id: params?.focus_person_id ?? 1,
    }),
  );
  vi.spyOn(apiClient, "listFamilyTreeStories").mockImplementation(async () => ({
    graph_revision: revision,
    items: [...stories],
    next_cursor: null,
  }));
  vi.spyOn(apiClient, "listFamilyTreeResidences").mockImplementation(
    async () => ({
      graph_revision: revision,
      items: [...residences],
      next_cursor: null,
    }),
  );
});
afterEach(() => vi.restoreAllMocks());
describe("FT2 real web core journeys at the API method seam", () => {
  it("first-person create initializes the actual empty collection and focuses readback", async () => {
    people = [];
    revision = 0;
    const create = vi
      .spyOn(apiClient, "createFamilyTreePerson")
      .mockImplementation(async (request) => {
        people = [
          {
            ...person(1, "First recorded person"),
            first_name: request.person.first_name ?? null,
          },
        ];
        return commit(request);
      });
    mount("/family-tree");
    const dialog = await open("Add first person");
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "First recorded person" },
    });
    await saveDialog();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_graph_revision: 0,
        person: expect.objectContaining({
          first_name: "First recorded person",
        }),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await screen.findByRole("region", {
      name: "Person details: First recorded person",
    });
    expect(apiClient.getFamilyTreePerson).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.queryByText("No active people are recorded."),
    ).not.toBeInTheDocument();
  });
  it("opens a disconnected directory person as a bookmark and fetches its focus", async () => {
    mount("/family-tree");
    await screen.findByRole("list", { name: "Recorded people" });
    const directory = within(
      screen.getByRole("list", { name: "Recorded people" }),
    );
    fireEvent.click(
      directory.getByRole("button", { name: "Show Disconnected in tree" }),
    );
    await screen.findByRole("region", { name: "Person details: Disconnected" });
    expect(apiClient.getFamilyTreePerson).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
      expect.objectContaining({ focus_person_id: 2 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("creates an atomic new relative and existing care link through typed workflow choices", async () => {
    const relative = vi
      .spyOn(apiClient, "createFamilyTreeRelative")
      .mockImplementation(async (request) => {
        people.push(person(3, request.person.first_name!));
        return commit(request, [1, 3]);
      });
    mount();
    let dialog = await open("Add relative or relationship");
    fireEvent.click(
      dialog.getByRole("button", { name: "Continue with new person" }),
    );
    dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "New parent" },
    });
    fireEvent.change(dialog.getByLabelText("Recorded relationship kind"), {
      target: { value: "adoptive" },
    });
    await saveDialog();
    expect(relative.mock.calls[0][0]).toMatchObject({
      anchor_person_id: 1,
      relationship: { direction: "parent", kind: "adoptive" },
      person: { first_name: "New parent" },
    });
    await screen.findByRole("region", { name: "Person details: New parent" });
    const care = vi
      .spyOn(apiClient, "createFamilyTreeCareLink")
      .mockImplementation(async (request) => commit(request, [3, 2]));
    dialog = await open("Add relative or relationship");
    fireEvent.change(dialog.getByLabelText("Relationship direction"), {
      target: { value: "caregiver" },
    });
    fireEvent.change(dialog.getByLabelText("Relative record"), {
      target: { value: "existing" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Select Disconnected (person 2)",
      }),
    );
    await saveDialog();
    expect(care.mock.calls[0][0]).toMatchObject({
      caregiver_person_id: 2,
      recipient_person_id: 3,
      kind: "caregiver",
    });
  });
  it("reads full stories and performs create/edit/reorder/delete with revisioned readbacks", async () => {
    const create = vi
      .spyOn(apiClient, "createFamilyTreeStory")
      .mockImplementation(async (id, request) => {
        stories.push({
          id: stories.length + 10,
          person_id: id,
          title: request.story.title,
          body_md: request.story.body_md,
          date: null,
          source_label: request.story.source_label ?? null,
          source_url: null,
          position: stories.length,
          created_by_user_id: adult.id,
        });
        return commit(request);
      });
    const patch = vi
      .spyOn(apiClient, "patchFamilyTreeStory")
      .mockImplementation(async (id, request) => {
        stories = stories.map((s) =>
          s.id === id
            ? {
                ...s,
                title: request.changes.title ?? s.title,
                body_md: request.changes.body_md ?? s.body_md,
              }
            : s,
        );
        return commit(request);
      });
    const reorder = vi
      .spyOn(apiClient, "reorderFamilyTreeStories")
      .mockImplementation(async (_id, request) => {
        stories = request.story_ids.map((id, position) => ({
          ...stories.find((s) => s.id === id)!,
          position,
        }));
        return commit(request);
      });
    const remove = vi
      .spyOn(apiClient, "deleteFamilyTreeStory")
      .mockImplementation(async (id, request) => {
        stories = stories.filter((s) => s.id !== id);
        return commit(request);
      });
    mount();
    for (const title of ["First story", "Second story"]) {
      const dialog = await open("Add story");
      fireEvent.change(dialog.getByLabelText("Story title (required)"), {
        target: { value: title },
      });
      fireEvent.change(
        dialog.getByLabelText("Full story (limited Markdown) (required)"),
        {
          target: { value: `${title}: full paragraph\n\n**Recorded memory**` },
        },
      );
      await saveDialog();
      await screen.findByRole("heading", { name: title });
    }
    expect(create).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("Recorded memory")).toHaveLength(2);
    let dialog = await open("Edit story First story");
    fireEvent.change(
      dialog.getByLabelText("Full story (limited Markdown) (required)"),
      { target: { value: "Edited complete story" } },
    );
    await saveDialog();
    await screen.findByText("Edited complete story");
    expect(patch.mock.calls[0][1].changes).toEqual({
      body_md: "Edited complete story",
    });
    await open("Move First story down");
    await saveDialog(true);
    expect(reorder.mock.calls[0][1].story_ids).toEqual([11, 10]);
    await open("Delete story First story");
    await saveDialog(true);
    expect(remove).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ expected_graph_revision: 5 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "First story" }),
      ).not.toBeInTheDocument(),
    );
  });
  it("performs residence create/edit/primary/delete with citation and true PATCH semantics", async () => {
    const create = vi
      .spyOn(apiClient, "createFamilyTreeResidence")
      .mockImplementation(async (id, request) => {
        residences.push({
          id: 20,
          person_id: id,
          place: request.residence.place,
          is_primary: request.residence.is_primary ?? false,
          start_date: null,
          end_date: null,
          notes_md: null,
          source_label: request.residence.source_label ?? null,
          source_url: null,
          created_by_user_id: adult.id,
        });
        return commit(request);
      });
    const patch = vi
      .spyOn(apiClient, "patchFamilyTreeResidence")
      .mockImplementation(async (id, request) => {
        residences = residences.map((r) =>
          r.id === id
            ? ({ ...r, ...request.changes } as FamilyTreeResidence)
            : r,
        );
        return commit(request);
      });
    const remove = vi
      .spyOn(apiClient, "deleteFamilyTreeResidence")
      .mockImplementation(async (id, request) => {
        residences = residences.filter((r) => r.id !== id);
        return commit(request);
      });
    mount();
    let dialog = await open("Add residence");
    fireEvent.change(dialog.getByLabelText("Residence place (required)"), {
      target: { value: "Old town" },
    });
    fireEvent.change(dialog.getByLabelText("Source label"), {
      target: { value: "Record book" },
    });
    await saveDialog();
    await screen.findByRole("heading", { name: "Old town" });
    expect(create.mock.calls[0][1].residence).toEqual({
      place: "Old town",
      is_primary: false,
      source_label: "Record book",
    });
    dialog = await open("Edit residence Old town");
    fireEvent.change(dialog.getByLabelText("Residence place (required)"), {
      target: { value: "New town" },
    });
    await saveDialog();
    expect(patch.mock.calls[0][1].changes).toEqual({ place: "New town" });
    await screen.findByRole("heading", { name: "New town" });
    await open("Set New town primary");
    await saveDialog(true);
    expect(patch.mock.calls[1][1].changes).toEqual({ is_primary: true });
    await screen.findByRole("heading", {
      name: "New town · Primary residence",
    });
    await open("Delete residence New town");
    await saveDialog(true);
    expect(remove).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ expected_graph_revision: 4 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /New town/ }),
      ).not.toBeInTheDocument(),
    );
  });
  it("identity link/unlink needs a selected target and explicit confirmation, never account creation", async () => {
    const candidates = vi
      .spyOn(apiClient, "listFamilyTreeIdentityCandidates")
      .mockResolvedValue({
        items: [
          {
            kind: "child",
            id: 8,
            label: "Existing child identity",
            active: true,
          },
        ],
      });
    const link = vi
      .spyOn(apiClient, "linkFamilyTreeIdentity")
      .mockImplementation(async (id, request) => {
        links.identity_link = {
          id: 9,
          person_id: id,
          user_id: null,
          child_id: 8,
          active: true,
          label: "Existing child identity",
        };
        return commit(request);
      });
    const unlink = vi
      .spyOn(apiClient, "unlinkFamilyTreeIdentity")
      .mockImplementation(async (_id, request) => {
        links.identity_link = null;
        return commit(request);
      });
    mount();
    await screen.findByRole("button", { name: "Choose identity to link" });
    expect(candidates).not.toHaveBeenCalled();
    await open("Choose identity to link");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "child: Existing child identity",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm change" }),
    ).toBeDisabled();
    expect(link).not.toHaveBeenCalled();
    await saveDialog(true);
    expect(link.mock.calls[0][1]).toMatchObject({
      confirmed: true,
      child_id: 8,
    });
    expect(link.mock.calls[0][1]).not.toHaveProperty("user_id");
    await screen.findByText("Existing child identity");
    await open("Unlink identity");
    await saveDialog(true);
    expect(unlink).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ expected_graph_revision: 2 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("locks/unlocks with reasons, and archives/restores without deleting people", async () => {
    const lock = vi
      .spyOn(apiClient, "lockFamilyTreePerson")
      .mockImplementation(async (_id, request) => {
        people[0] = {
          ...people[0],
          is_locked: true,
          lock_reason: request.reason,
        };
        return commit(request);
      });
    const unlock = vi
      .spyOn(apiClient, "unlockFamilyTreePerson")
      .mockImplementation(async (_id, request) => {
        people[0] = { ...people[0], is_locked: false, lock_reason: null };
        return commit(request);
      });
    const archive = vi
      .spyOn(apiClient, "archiveFamilyTreePerson")
      .mockImplementation(async (_id, request) => {
        people[0] = { ...people[0], archived_at: "2026-10-13T00:00:00Z" };
        return commit(request);
      });
    const restore = vi
      .spyOn(apiClient, "restoreFamilyTreePerson")
      .mockImplementation(async (_id, request) => {
        people[0] = { ...people[0], archived_at: null };
        return commit(request);
      });
    mount();
    let dialog = await open("Lock person");
    fireEvent.change(dialog.getByLabelText("Reason to lock (required)"), {
      target: { value: "Reviewing" },
    });
    fireEvent.click(dialog.getByLabelText("I confirm this specific change."));
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await screen.findByRole("button", { name: "Unlock person" });
    expect(screen.getByRole("button", { name: "Edit person" })).toBeDisabled();
    expect(lock.mock.calls[0][1].reason).toBe("Reviewing");
    dialog = await open("Unlock person");
    fireEvent.change(dialog.getByLabelText("Reason to unlock (required)"), {
      target: { value: "Reviewed" },
    });
    fireEvent.click(dialog.getByLabelText("I confirm this specific change."));
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(unlock.mock.calls[0][1].reason).toBe("Reviewed");
    await open("Archive person");
    await saveDialog(true);
    await screen.findByRole("button", { name: "Restore person" });
    expect(people).toHaveLength(2);
    await open("Restore person");
    await saveDialog(true);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(people[0].archived_at).toBeNull();
  });
  it.each(["parent", "care", "partner"] as const)(
    "edits and deletes a recorded %s relationship without deleting endpoints",
    async (type) => {
      const base = {
        id: 20,
        created_by_user_id: adult.id,
        notes_md: "Recorded evidence",
        source_label: null,
        source_url: null,
      };
      if (type === "parent")
        links.parent_links = [
          {
            ...base,
            parent_person_id: 2,
            child_person_id: 1,
            kind: "biological",
          },
        ];
      else if (type === "care")
        links.care_links = [
          {
            ...base,
            caregiver_person_id: 2,
            recipient_person_id: 1,
            kind: "guardian",
            start_date: null,
            end_date: null,
          },
        ];
      else
        links.partner_episodes = [
          {
            ...base,
            person_a_id: 1,
            person_b_id: 2,
            kind: "married",
            status: "current",
            start_date: null,
            end_date: null,
          },
        ];
      const patch =
        type === "parent"
          ? vi
              .spyOn(apiClient, "patchFamilyTreeParentLink")
              .mockImplementation(async (_id, request) => {
                links.parent_links[0] = {
                  ...links.parent_links[0],
                  ...request.changes,
                } as (typeof links.parent_links)[number];
                return commit(request);
              })
          : type === "care"
            ? vi
                .spyOn(apiClient, "patchFamilyTreeCareLink")
                .mockImplementation(async (_id, request) => {
                  links.care_links[0] = {
                    ...links.care_links[0],
                    ...request.changes,
                  } as (typeof links.care_links)[number];
                  return commit(request);
                })
            : vi
                .spyOn(apiClient, "patchFamilyTreePartnerEpisode")
                .mockImplementation(async (_id, request) => {
                  links.partner_episodes[0] = {
                    ...links.partner_episodes[0],
                    ...request.changes,
                  } as (typeof links.partner_episodes)[number];
                  return commit(request);
                });
      const remove =
        type === "parent"
          ? vi
              .spyOn(apiClient, "deleteFamilyTreeParentLink")
              .mockImplementation(async (_id, request) => {
                links.parent_links = [];
                return commit(request);
              })
          : type === "care"
            ? vi
                .spyOn(apiClient, "deleteFamilyTreeCareLink")
                .mockImplementation(async (_id, request) => {
                  links.care_links = [];
                  return commit(request);
                })
            : vi
                .spyOn(apiClient, "deleteFamilyTreePartnerEpisode")
                .mockImplementation(async (_id, request) => {
                  links.partner_episodes = [];
                  return commit(request);
                });
      mount();
      let dialog = await open(
        type === "partner"
          ? "Edit partnership 20"
          : `Edit ${type} relationship 20`,
      );
      fireEvent.change(dialog.getByLabelText("Notes (limited Markdown)"), {
        target: { value: "" },
      });
      await saveDialog();
      expect(patch).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ changes: { notes_md: null } }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      await open(
        type === "partner"
          ? "Delete partnership 20"
          : `Delete ${type} relationship 20`,
      );
      await saveDialog(true);
      expect(remove).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ expected_graph_revision: 2 }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(people).toHaveLength(2);
    },
  );
});
