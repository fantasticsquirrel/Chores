import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { onlineManager } from "@tanstack/react-query";
import { FamilyTreePage } from "./FamilyTreePage";
import { ApiClientError, apiClient, type FamilyTreePerson } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import {
  adult,
  collection,
  detail,
  graph,
  mutation,
  person,
} from "../features/family-tree/forms/testFixtures";

let record: FamilyTreePerson, revision: number;
const access = (manage: boolean | undefined = true) =>
  ({
    modules: [
      {
        key: "family-tree",
        name: "Family Tree",
        description: "Private records",
        can_manage: manage,
      },
    ],
  }) as Awaited<ReturnType<typeof apiClient.getMyModules>>;
const auth = (extra: Partial<AuthContextValue> = {}): AuthContextValue => ({
  status: "authenticated",
  user: adult,
  moduleKeys: ["family-tree"],
  manageableModuleKeys: ["family-tree"],
  setAuthenticatedSession: vi.fn(),
  clearSession: vi.fn(),
  logout: vi.fn(),
  refreshModuleAccess: vi.fn(),
  ...extra,
});
function renderTree(value = auth(), path = "/family-tree/people/1") {
  const ui = (context: AuthContextValue) => (
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/family-tree" element={<FamilyTreePage />} />
          <Route
            path="/family-tree/people/:personId"
            element={<FamilyTreePage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
  const rendered = render(ui(value));
  return {
    ...rendered,
    update: (context: AuthContextValue) => rendered.rerender(ui(context)),
  };
}
async function edit() {
  fireEvent.click(await screen.findByRole("button", { name: "Edit person" }));
  return screen.getByRole("dialog");
}
beforeEach(() => {
  vi.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
  record = person();
  revision = 1;
  onlineManager.setOnline(true);
  act(() => window.dispatchEvent(new Event("online")));
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue(access());
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockImplementation(async () =>
    collection(revision),
  );
  vi.spyOn(apiClient, "listFamilyTreePeople").mockImplementation(async () => ({
    graph_revision: revision,
    items: [record],
    total: 1,
    next_cursor: null,
  }));
  vi.spyOn(apiClient, "getFamilyTreePerson").mockImplementation(async () =>
    detail(record, revision),
  );
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(async () =>
    graph([record], revision),
  );
  vi.spyOn(apiClient, "listFamilyTreeStories").mockImplementation(async () => ({
    graph_revision: revision,
    items: [],
    next_cursor: null,
  }));
  vi.spyOn(apiClient, "listFamilyTreeResidences").mockImplementation(
    async () => ({ graph_revision: revision, items: [], next_cursor: null }),
  );
  vi.spyOn(apiClient, "patchFamilyTreePerson").mockImplementation(
    async (_id, request) => {
      record = {
        ...record,
        ...request.changes,
        aliases: record.aliases,
        birth_date: record.birth_date,
        death_date: record.death_date,
      };
      revision++;
      return mutation(revision);
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("Independent revision-baseline probes", () => {
  it("an open person draft must not silently adopt a refreshed collection revision", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "My stale draft" },
    });
    const beforeReads = vi.mocked(apiClient.getFamilyTreeCollection).mock.calls
      .length;
    revision = 2;
    record = { ...record, first_name: "Other adult saved" };
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(
        vi.mocked(apiClient.getFamilyTreeCollection).mock.calls.length,
      ).toBeGreaterThan(beforeReads),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Save changes" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1),
    );
    const submitted = vi.mocked(apiClient.patchFamilyTreePerson).mock
      .calls[0][1];
    expect(submitted.expected_graph_revision).toBe(1);
  });
  it("a known successful mutation followed by collection GET failure must retry only GET", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Saved once" },
    });
    const beforeReads = vi.mocked(apiClient.getFamilyTreeCollection).mock.calls
      .length;
    vi.mocked(apiClient.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("Collection read interrupted"),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await screen.findByRole("button", { name: "Retry saved readback" });
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry saved readback" }),
    );
    await waitFor(() =>
      expect(
        vi.mocked(apiClient.getFamilyTreeCollection).mock.calls.length,
      ).toBeGreaterThan(beforeReads + 1),
    );
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
  });
});

const revisionConflict = () =>
  new ApiClientError(409, "Changed remotely", {
    detail: { code: "revision_conflict", message: "Changed remotely" },
  });
const citation = {
  notes_md: "Evidence",
  source_label: null,
  source_url: null,
  created_by_user_id: 41,
};
function recordedSections() {
  vi.mocked(apiClient.listFamilyTreeStories).mockImplementation(async () => ({
    graph_revision: revision,
    next_cursor: null,
    items: [
      {
        id: 10,
        person_id: 1,
        title: "First",
        body_md: "Complete story",
        position: 0,
        date: null,
        source_label: null,
        source_url: null,
        created_by_user_id: 41,
      },
      {
        id: 11,
        person_id: 1,
        title: "Second",
        body_md: "Second story",
        position: 1,
        date: null,
        source_label: null,
        source_url: null,
        created_by_user_id: 41,
      },
    ],
  }));
  vi.mocked(apiClient.listFamilyTreeResidences).mockImplementation(
    async () => ({
      graph_revision: revision,
      next_cursor: null,
      items: [
        {
          ...citation,
          id: 12,
          person_id: 1,
          place: "Town",
          is_primary: false,
          start_date: null,
          end_date: null,
        },
      ],
    }),
  );
  vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(async () => ({
    ...detail(record, revision),
    parent_links: [
      {
        ...citation,
        id: 20,
        parent_person_id: 2,
        child_person_id: 1,
        kind: "biological",
      },
    ],
    care_links: [
      {
        ...citation,
        id: 21,
        caregiver_person_id: 2,
        recipient_person_id: 1,
        kind: "guardian",
        start_date: null,
        end_date: null,
      },
    ],
    partner_episodes: [
      {
        ...citation,
        id: 22,
        person_a_id: 1,
        person_b_id: 2,
        kind: "married",
        status: "current",
        start_date: null,
        end_date: null,
      },
    ],
    identity_link: {
      id: 23,
      person_id: 1,
      user_id: 41,
      child_id: null,
      active: true,
      label: "Adult",
    },
  }));
}
const intentCases = [
  [
    "Edit story First",
    "patchFamilyTreeStory",
    "Story title (required)",
    "Draft story",
  ],
  [
    "Edit residence Town",
    "patchFamilyTreeResidence",
    "Residence place (required)",
    "Draft town",
  ],
  [
    "Edit parent relationship 20",
    "patchFamilyTreeParentLink",
    "Notes (limited Markdown)",
    "Draft parent",
  ],
  [
    "Edit care relationship 21",
    "patchFamilyTreeCareLink",
    "Notes (limited Markdown)",
    "Draft care",
  ],
  [
    "Edit partnership 22",
    "patchFamilyTreePartnerEpisode",
    "Notes (limited Markdown)",
    "Draft partnership",
  ],
  ["Delete story First", "deleteFamilyTreeStory", "confirm", ""],
  ["Delete residence Town", "deleteFamilyTreeResidence", "confirm", ""],
  ["Set Town primary", "patchFamilyTreeResidence", "confirm", ""],
  ["Move First down", "reorderFamilyTreeStories", "confirm", ""],
  [
    "Delete parent relationship 20",
    "deleteFamilyTreeParentLink",
    "confirm",
    "",
  ],
  ["Delete care relationship 21", "deleteFamilyTreeCareLink", "confirm", ""],
  ["Delete partnership 22", "deleteFamilyTreePartnerEpisode", "confirm", ""],
  ["Archive person", "archiveFamilyTreePerson", "confirm", ""],
  ["Unlink identity", "unlinkFamilyTreeIdentity", "confirm", ""],
  [
    "Lock person",
    "lockFamilyTreePerson",
    "Reason to lock (required)",
    "Reviewed reason",
  ],
  ["Add story", "createFamilyTreeStory", "Story title (required)", "New story"],
  [
    "Add residence",
    "createFamilyTreeResidence",
    "Residence place (required)",
    "New town",
  ],
  [
    "Add disconnected person",
    "createFamilyTreePerson",
    "First name",
    "New person",
  ],
] as const;
describe("Origin revision across core intent callers", () => {
  it.each(intentCases)(
    "%s retains its authoritative opening revision after access refresh",
    async (button, method, field, value) => {
      recordedSections();
      const send = vi
        .spyOn(apiClient, method)
        .mockRejectedValue(revisionConflict());
      renderTree();
      await screen.findByRole("heading", { name: "First" });
      if (button === "Add disconnected person") fireEvent.click(screen.getByRole("button", { name: "People" }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: button })).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: button }));
      const dialog = within(screen.getByRole("dialog"));
      if (field === "confirm")
        fireEvent.click(
          dialog.getByLabelText("I confirm this specific change."),
        );
      else {
        fireEvent.change(dialog.getByLabelText(field), { target: { value } });
        if (button === "Add story")
          fireEvent.change(
            dialog.getByLabelText("Full story (limited Markdown) (required)"),
            { target: { value: "New body" } },
          );
        if (button === "Lock person")
          fireEvent.click(
            dialog.getByLabelText("I confirm this specific change."),
          );
      }
      revision = 2;
      act(() => window.dispatchEvent(new Event("focus")));
      const saveName = field === "confirm" ? "Confirm change" : "Save changes";
      await waitFor(() =>
        expect(dialog.getByRole("button", { name: saveName })).toBeEnabled(),
      );
      fireEvent.click(dialog.getByRole("button", { name: saveName }));
      await dialog.findByRole("button", { name: "Review latest records" });
      expect(send).toHaveBeenCalledTimes(1);
      const submitted = send.mock.calls[0].find(
        (arg) =>
          arg && typeof arg === "object" && "expected_graph_revision" in arg,
      );
      expect(submitted).toMatchObject({
        expected_graph_revision: 1,
        idempotency_key: expect.any(String),
      });
      if (field !== "confirm")
        expect(dialog.getByLabelText(field)).toHaveValue(value);
    },
  );
  it("cached person older than a known collection floor cannot originate an editor", async () => {
    renderTree();
    await screen.findByRole("button", { name: "Edit person" });
    vi.mocked(apiClient.getFamilyTreePerson).mockResolvedValue(
      detail(record, 1),
    );
    revision = 2;
    act(() => window.dispatchEvent(new Event("focus")));
    await screen.findByText(/Stale read discarded/);
    expect(screen.getByRole("button", { name: "Edit person" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit person" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiClient.patchFamilyTreePerson).not.toHaveBeenCalled();
  });
  it("new relative draft uses the anchor detail snapshot, not a later floor", async () => {
    const send = vi
      .spyOn(apiClient, "createFamilyTreeRelative")
      .mockRejectedValue(revisionConflict());
    renderTree();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add relative or relationship",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with new person" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "Relative" },
    });
    revision = 2;
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Save changes" }),
      ).toBeEnabled(),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByRole("button", { name: "Review latest records" });
    expect(send.mock.calls[0][0]).toMatchObject({
      expected_graph_revision: 1,
      person: { first_name: "Relative" },
    });
  });
});

describe("Readback and explicit review boundaries", () => {
  it("failed latest-target GET cannot approve a rebase", async () => {
    vi.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce(
      revisionConflict(),
    );
    renderTree();
    const dialog = within(await edit());
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "Kept draft" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByRole("button", { name: "Review latest records" });
    revision = 2;
    vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
      new Error("Latest target unavailable"),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Review latest records" }),
    );
    await dialog.findByText(/Latest target unavailable/);
    expect(
      dialog.queryByRole("button", { name: /Reapply reviewed/ }),
    ).not.toBeInTheDocument();
    expect(dialog.getByLabelText("First name")).toHaveValue("Kept draft");
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
  });
  it("known saved recovery survives repeated collection and affected-target GET failure without another PATCH", async () => {
    renderTree();
    const dialog = within(await edit());
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "Saved exactly once" },
    });
    vi.mocked(apiClient.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("First collection interruption"),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByRole("button", { name: "Retry saved readback" });
    vi.mocked(apiClient.getFamilyTreeCollection).mockRejectedValueOnce(
      new Error("Second collection interruption"),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Retry saved readback" }),
    );
    await dialog.findByText(/Second collection interruption/);
    vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
      new Error("Saved target read interrupted"),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Retry saved readback" }),
    );
    await dialog.findByText(/Saved target read interrupted/);
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    expect(dialog.getByLabelText("First name")).toHaveValue(
      "Saved exactly once",
    );
    vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(async () =>
      detail(record, revision),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "Retry saved readback" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Saved exactly once", { selector: "dd" }),
    ).toBeInTheDocument();
  });
});
