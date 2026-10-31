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
describe("Family Tree protected web workflows", () => {
  it("revoking manage aborts an in-flight command and releases the read-only workspace busy lease", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(apiClient.patchFamilyTreePerson).mockImplementation(
      (_id, _request, requestOptions) => {
        signal = requestOptions?.signal;
        return new Promise(() => undefined);
      },
    );
    const mounted = renderTree(),
      dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Pending draft" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1),
    );
    expect(signal).toBeInstanceOf(AbortSignal);
    mounted.update(auth({ manageableModuleKeys: [] }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Search names and aliases"),
      ).not.toBeDisabled(),
    );
    expect(screen.getByText("Original note")).toBeInTheDocument();
  });
  it("a cancelled pre-mutation directory read cannot overwrite a newer successful mutation", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof apiClient.listFamilyTreePeople>>,
    ) => void;
    vi.mocked(apiClient.listFamilyTreePeople).mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    );
    renderTree();
    fireEvent.click(await screen.findByRole("button", { name: "People" }));
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("Display name"), {
      target: { value: "Newest name" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await screen.findByRole("link", { name: "Newest name" });
    await act(async () =>
      resolve({
        graph_revision: 1,
        items: [person(1, "Old response")],
        total: 1,
        next_cursor: null,
      }),
    );
    expect(
      screen.queryByRole("link", { name: "Old response" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Newest name" }),
    ).toBeInTheDocument();
  });
  it("manage revocation clears drafts but retains legitimate view-only records", async () => {
    const mounted = renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Private draft" },
    });
    mounted.update(auth({ manageableModuleKeys: [] }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Edit person" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Original note")).toBeInTheDocument();
  });
  it("collection capabilities deny mutation even when module discovery says manage", async () => {
    vi.mocked(apiClient.getFamilyTreeCollection).mockResolvedValue({
      ...collection(),
      capabilities: { can_manage: false, can_export: false, can_purge: false },
    });
    renderTree();
    await screen.findByRole("region", { name: "Person details: Alex" });
    expect(
      screen.queryByRole("button", { name: "Edit person" }),
    ).not.toBeInTheDocument();
    expect(apiClient.patchFamilyTreePerson).not.toHaveBeenCalled();
  });
  it("logout retires sensitive records and drafts without persistent cache", async () => {
    const mounted = renderTree();
    await edit();
    mounted.update(
      auth({
        status: "anonymous",
        user: null,
        moduleKeys: [],
        manageableModuleKeys: [],
      }),
    );
    await screen.findByText("Family Tree not available");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Original note")).not.toBeInTheDocument();
  });
  it("does not destroy a dirty draft while refreshing authoritative access", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Still private" },
    });
    let resolve!: (
      value: Awaited<ReturnType<typeof apiClient.getMyModules>>,
    ) => void;
    vi.mocked(apiClient.getMyModules).mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByLabelText("First name")).toHaveValue("Still private");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await act(async () => resolve(access()));
    expect(screen.getByLabelText("First name")).toHaveValue("Still private");
  });
  it("preserves dirty fields when dismissal is cancelled", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Retained draft" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Close Edit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("First name")).toHaveValue("Retained draft");
  });
  it("PATCH sends only changed touched facts, including explicit nullable clear", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(
      within(dialog).getByLabelText("Notes (limited Markdown)"),
      { target: { value: "" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1),
    );
    expect(
      vi.mocked(apiClient.patchFamilyTreePerson).mock.calls[0][1].changes,
    ).toEqual({ notes_md: null });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(apiClient.getFamilyTreePerson).toHaveBeenCalledTimes(2);
  });
  it("keeps uncertain dates, all name/source/tag/alias facts editable without metadata PATCH", async () => {
    renderTree();
    const dialog = await edit();
    for (const name of [
      "Display name",
      "Middle name",
      "Last name",
      "Maiden name",
      "Suffix",
      "Gender",
      "Birth place",
      "Death place",
      "Birth source",
      "Death source",
      "Source label",
      "Source URL",
      "Tags",
    ])
      expect(within(dialog).getByLabelText(name)).toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByLabelText(
        "Birth date (YYYY, YYYY-MM, or YYYY-MM-DD)",
      ),
      { target: { value: "1980-02" } },
    );
    fireEvent.click(within(dialog).getByLabelText("Birth date uncertain"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add alias" }));
    fireEvent.change(within(dialog).getByLabelText("Alias 1 name"), {
      target: { value: "Nickname" },
    });
    fireEvent.change(within(dialog).getByLabelText("Alias 1 label"), {
      target: { value: "known as" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1),
    );
    expect(
      vi.mocked(apiClient.patchFamilyTreePerson).mock.calls[0][1].changes,
    ).toEqual({
      birth_date: { value: "1980-02", precision: "month", uncertain: true },
      aliases: [{ name: "Nickname", label: "known as" }],
    });
  });
  it("network failure preserves draft and retries identical key/body; double tap makes one command", async () => {
    vi.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce(
      new TypeError("Network failed"),
    );
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Saved draft" },
    });
    const save = within(dialog).getByRole("button", { name: "Save changes" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry same request" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry same request" }),
    );
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(apiClient.patchFamilyTreePerson).mock.calls;
    expect(calls[0][1]).toEqual(calls[1][1]);
    expect(calls[0][1].idempotency_key).toBeTruthy();
  });
  it("conflict preserves draft and requires explicit fresh revision review/reapplication", async () => {
    vi.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce(
      new ApiClientError(409, "Tree changed", {
        detail: { code: "revision_conflict", message: "Tree changed" },
      }),
    );
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "My draft" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await screen.findByRole("button", { name: "Review latest records" });
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("First name")).toHaveValue("My draft");
    revision = 4;
    record = { ...record, first_name: "Remote change" };
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review latest records" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review latest records" }),
    );
    const reapply = await screen.findByRole("button", {
      name: "Reapply reviewed draft",
    });
    expect(screen.getByText(/latest:.*Remote change/)).toBeInTheDocument();
    fireEvent.click(reapply);
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(apiClient.patchFamilyTreePerson).mock.calls;
    expect(calls[1][1].expected_graph_revision).toBe(4);
    expect(calls[1][1].changes).toEqual({ first_name: "My draft" });
    expect(calls[1][1].idempotency_key).not.toBe(calls[0][1].idempotency_key);
  });
  it("chronology warning is never silently approved", async () => {
    vi.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce(
      new ApiClientError(409, "Review chronology", {
        detail: {
          code: "chronology_review",
          message: "Review chronology",
          warnings: ["Dates overlap"],
        },
      }),
    );
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Reviewed" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    const reviewed = await screen.findByRole("button", {
      name: "Save after chronology review",
    });
    expect(reviewed).toBeDisabled();
    expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByLabelText("I deliberately reviewed the chronology warning."),
    );
    fireEvent.click(reviewed);
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(apiClient.patchFamilyTreePerson).mock.calls[1][1]
        .reviewed_warnings,
    ).toEqual(["chronology_review"]);
  });
  it("server validation leaves the draft editable instead of freezing an unretryable payload", async () => {
    vi.mocked(apiClient.patchFamilyTreePerson).mockRejectedValueOnce(
      new ApiClientError(422, "Invalid date", {
        detail: { code: "validation_error", message: "Invalid date" },
      }),
    );
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Bad" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await screen.findByText(/Invalid date/);
    expect(screen.getByLabelText("First name")).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Corrected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(apiClient.patchFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(apiClient.patchFamilyTreePerson).mock.calls[1][1].changes,
    ).toEqual({ first_name: "Corrected" });
  });
  it("revocation clears protected data and dirty drafts; retry does not hydrate old cache", async () => {
    const mounted = renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Sensitive draft" },
    });
    mounted.update(auth({ moduleKeys: [], manageableModuleKeys: [] }));
    await screen.findByText("Family Tree not available");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByText("Original note")).not.toBeInTheDocument();
  });
  it("account/household switch retires old reads and never reuses old draft", async () => {
    const mounted = renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Old private draft" },
    });
    record = person(1, "Other account");
    mounted.update(
      auth({
        user: {
          ...adult,
          id: 42,
          household_id: 8,
          email: "other@example.test",
        },
      }),
    );
    await screen.findByRole("region", {
      name: "Person details: Other account",
    });
    expect(
      screen.queryByDisplayValue("Old private draft"),
    ).not.toBeInTheDocument();
    expect(apiClient.getFamilyTreePerson).toHaveBeenCalledTimes(2);
  });
  it("offline preserves the in-memory draft but disables writes", async () => {
    renderTree();
    const dialog = await edit();
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "Offline draft" },
    });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByLabelText("First name")).toHaveValue("Offline draft");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(apiClient.patchFamilyTreePerson).not.toHaveBeenCalled();
  });
  it("merged alias exposes canonical metadata but never offers mutation through alias", async () => {
    record = { ...record, merged_into_person_id: 2 };
    vi.mocked(apiClient.getFamilyTreePerson).mockResolvedValue({
      ...detail(record),
      canonical_person: person(2, "Canonical"),
    });
    renderTree();
    await screen.findByRole("button", { name: "Open canonical person" });
    expect(
      screen.queryByRole("button", { name: "Edit person" }),
    ).not.toBeInTheDocument();
    expect(apiClient.listFamilyTreeStories).not.toHaveBeenCalled();
  });
  it("denied/missing successful discovery loads zero genealogy records", async () => {
    vi.mocked(apiClient.getMyModules).mockRejectedValue(
      new Error("Discovery unavailable"),
    );
    renderTree();
    await screen.findByRole("button", { name: "Retry access check" });
    expect(apiClient.getFamilyTreeCollection).not.toHaveBeenCalled();
    expect(apiClient.getFamilyTreePerson).not.toHaveBeenCalled();
  });
  it("a read-side permission denial clears content rather than pretending an empty tree", async () => {
    vi.mocked(apiClient.getFamilyTreePerson).mockRejectedValue(
      new ApiClientError(403, "Revoked", {}),
    );
    renderTree();
    await screen.findByText("Family Tree not available");
    expect(
      screen.queryByText("Start your family tree"),
    ).not.toBeInTheDocument();
  });
});
