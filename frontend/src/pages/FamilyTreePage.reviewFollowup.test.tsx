import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FamilyTreePage } from "./FamilyTreePage";
import { apiClient, ApiClientError, type FamilyTreeIdentityLink } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import {
  adult,
  collection,
  detail,
  graph,
  mutation,
  person,
} from "../features/family-tree/forms/testFixtures";

let revision: number;
let record: ReturnType<typeof person>;
const conflict = () =>
  new ApiClientError(409, "Remote update", {
    detail: { code: "revision_conflict", message: "Remote update" },
  });
const chronology = () =>
  new ApiClientError(422, "Check chronology", {
    detail: {
      code: "chronology_review",
      message: "Check chronology",
      warnings: ["chronology_review"],
    },
  });
const auth: AuthContextValue = {
  status: "authenticated",
  user: adult,
  moduleKeys: ["family-tree"],
  manageableModuleKeys: ["family-tree"],
  setAuthenticatedSession: vi.fn(),
  clearSession: vi.fn(),
  logout: vi.fn(),
  refreshModuleAccess: vi.fn(),
};
function mount() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/family-tree/people/1"]}>
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
beforeEach(() => {
  revision = 1;
  record = person();
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [
      {
        key: "family-tree",
        name: "Family Tree",
        description: "Private records",
        can_manage: true,
      },
    ],
  } as Awaited<ReturnType<typeof apiClient.getMyModules>>);
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockImplementation(async () =>
    collection(revision),
  );
  vi.spyOn(apiClient, "getFamilyTreePerson").mockImplementation(async () =>
    detail(record, revision),
  );
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(async () =>
    graph([record], revision),
  );
  vi.spyOn(apiClient, "listFamilyTreePeople").mockImplementation(async () => ({
    graph_revision: revision,
    items: [record],
    total: 1,
    next_cursor: null,
  }));
  vi.spyOn(apiClient, "listFamilyTreeStories").mockImplementation(async () => ({
    graph_revision: revision,
    items: [],
    next_cursor: null,
  }));
  vi.spyOn(apiClient, "listFamilyTreeResidences").mockImplementation(
    async () => ({ graph_revision: revision, items: [], next_cursor: null }),
  );
  vi.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
  vi.spyOn(apiClient, "patchFamilyTreePerson").mockImplementation(
    async (_id, body) => {
      record = {
        ...record,
        ...body.changes,
        aliases: record.aliases,
        birth_date: record.birth_date,
        death_date: record.death_date,
      };
      revision++;
      return mutation(revision);
    },
  );
});
afterEach(() => vi.restoreAllMocks());

it.each(["conflict", "chronology"] as const)(
  "retains the acknowledged %s reapplication until receipt-bound GET recovery succeeds",
  async (kind) => {
    const patch = vi.mocked(apiClient.patchFamilyTreePerson);
    patch.mockRejectedValueOnce(
      kind === "conflict" ? conflict() : chronology(),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Edit person" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("First name"), {
      target: { value: "Retained local draft" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    if (kind === "conflict") {
      await dialog.findByRole("button", { name: "Review latest records" });
      revision = 2;
      fireEvent.click(
        dialog.getByRole("button", { name: "Review latest records" }),
      );
      await dialog.findByRole("button", {
        name: /Reapply reviewed draft/,
      });
    } else {
      fireEvent.click(
        await dialog.findByLabelText(
          "I deliberately reviewed the chronology warning.",
        ),
      );
    }
    vi.mocked(apiClient.getFamilyTreeCollection).mockRejectedValue(
      new Error("Acknowledged reapplication readback interrupted"),
    );
    fireEvent.click(
      dialog.getByRole("button", {
        name:
          kind === "conflict"
            ? /Reapply reviewed draft/
            : "Save after chronology review",
      }),
    );
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry saved readback" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText(/Saved at revision/)).not.toBeInTheDocument();
    vi.mocked(apiClient.getFamilyTreeCollection).mockImplementation(async () =>
      collection(revision),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retry saved readback" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(patch).toHaveBeenCalledTimes(2);
  },
);

it("shows original and replacement identity association before revision-bound unlink reapplication", async () => {
  let identity: FamilyTreeIdentityLink = {
    id: 61,
    person_id: 1,
    user_id: 41,
    child_id: null,
    active: true,
    label: "Originally confirmed adult",
  };
  vi.mocked(apiClient.getFamilyTreePerson).mockImplementation(async () => ({
    ...detail(record, revision),
    identity_link: identity,
  }));
  const unlink = vi
    .spyOn(apiClient, "unlinkFamilyTreeIdentity")
    .mockRejectedValue(conflict());
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Unlink identity" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByLabelText("I confirm this specific change."));
  fireEvent.click(dialog.getByRole("button", { name: "Confirm change" }));
  await dialog.findByRole("button", { name: "Review latest records" });
  revision = 3;
  identity = {
    id: 62,
    person_id: 1,
    user_id: null,
    child_id: 52,
    active: true,
    label: "Replacement child identity",
  };
  fireEvent.click(
    dialog.getByRole("button", { name: "Review latest records" }),
  );
  const reapply = await dialog.findByRole("button", {
    name: /Reapply reviewed draft/,
  });
  expect(reapply).toBeEnabled();
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Replacement child identity",
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Originally confirmed adult",
  );
  expect(screen.getByRole("dialog")).not.toHaveTextContent('"user_id":41');
  expect(screen.getByRole("dialog")).not.toHaveTextContent('"child_id":52');
  fireEvent.click(reapply);
  await waitFor(() => expect(unlink).toHaveBeenCalledTimes(2));
  expect(unlink.mock.calls[0][1].expected_graph_revision).toBe(1);
  expect(unlink.mock.calls[1][1].expected_graph_revision).toBe(3);
  expect(unlink.mock.calls[1][1].idempotency_key).not.toBe(
    unlink.mock.calls[0][1].idempotency_key,
  );
});
