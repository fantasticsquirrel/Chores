import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
import { apiClient, type FamilyTreeGraphProjection } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import {
  adult,
  collection,
  detail,
  person,
  graph,
} from "../features/family-tree/forms/testFixtures";
const a = person(1, "Alex"),
  b = person(2, "Disconnected");
function mount() {
  const value: AuthContextValue = {
    status: "authenticated",
    user: adult,
    moduleKeys: ["family-tree"],
    manageableModuleKeys: ["family-tree"],
    refreshModuleAccess: vi.fn(),
    setAuthenticatedSession: vi.fn(),
    clearSession: vi.fn(),
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/family-tree/people/1"]}>
        <Routes>
          <Route
            path="/family-tree/people/:personId"
            element={<FamilyTreePage />}
          />
          <Route path="/family-tree" element={<FamilyTreePage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  vi.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
  onlineManager.setOnline(true);
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [{ key: "family-tree", can_manage: true }],
  } as Awaited<ReturnType<typeof apiClient.getMyModules>>);
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockResolvedValue(
    collection(3, 2),
  );
  vi.spyOn(apiClient, "listFamilyTreePeople").mockResolvedValue({
    graph_revision: 3,
    items: [a, b],
    total: 2,
    next_cursor: null,
  });
  vi.spyOn(apiClient, "getFamilyTreePerson").mockResolvedValue(detail(a, 3));
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockResolvedValue(graph([a], 3));
  vi.spyOn(apiClient, "listFamilyTreeStories").mockResolvedValue({
    graph_revision: 3,
    items: [],
    next_cursor: null,
  });
  vi.spyOn(apiClient, "listFamilyTreeResidences").mockResolvedValue({
    graph_revision: 3,
    items: [],
    next_cursor: null,
  });
});
afterEach(() => vi.restoreAllMocks());
describe("FT2 directory, bounded graph and typed comparison", () => {
  it("paginates exact backend cursors and resets search/tag/living/archive query keys", async () => {
    vi.mocked(apiClient.listFamilyTreePeople).mockImplementation(
      async (params) => ({
        graph_revision: 3,
        items: params?.cursor ? [b] : [a],
        total: 2,
        next_cursor: params?.cursor ? null : 2,
      }),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Load more people" }),
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("list", { name: "Recorded people" }),
        ).getAllByRole("listitem"),
      ).toHaveLength(2),
    );
    expect(apiClient.listFamilyTreePeople).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 2, limit: 40 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.change(screen.getByLabelText("Search names and aliases"), {
      target: { value: "Alex" },
    });
    await waitFor(() =>
      expect(apiClient.listFamilyTreePeople).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: "Alex", cursor: null }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.change(screen.getByLabelText("Tag filter"), {
      target: { value: "recorded" },
    });
    fireEvent.change(screen.getByLabelText("Living status filter"), {
      target: { value: "unknown" },
    });
    fireEvent.click(screen.getByLabelText("Archived people"));
    await waitFor(() =>
      expect(apiClient.listFamilyTreePeople).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: "Alex",
          tag: "recorded",
          living_status: "unknown",
          archived: true,
          cursor: null,
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
  it("refuses to union mixed-revision directory pages and offers an explicit restart", async () => {
    vi.mocked(apiClient.listFamilyTreePeople).mockImplementation(
      async (params) => ({
        graph_revision: params?.cursor ? 4 : 3,
        items: params?.cursor ? [b] : [a],
        total: 2,
        next_cursor: params?.cursor ? null : 2,
      }),
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Load more people" }),
    );
    await screen.findByRole("button", { name: "Refresh people directory" });
    expect(
      within(
        screen.getByRole("list", { name: "Recorded people" }),
      ).queryAllByRole("listitem"),
    ).toHaveLength(0);
    vi.mocked(apiClient.listFamilyTreePeople).mockResolvedValue({
      graph_revision: 4,
      items: [b],
      total: 1,
      next_cursor: null,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh people directory" }),
    );
    expect(
      await screen.findByRole("link", { name: "Disconnected" }),
    ).toBeInTheDocument();
  });
  it("care/history lenses re-fetch the server projection and preserve real branch depth expansion", async () => {
    vi.mocked(apiClient.getFamilyTreeGraph).mockResolvedValue({
      ...graph([a], 3),
      nodes: [
        {
          ...graph([a], 3).nodes[0],
          expansion_counts: { parents: 1, children: 0, partners: 0, care: 1 },
        },
      ],
    });
    mount();
    fireEvent.click(await screen.findByLabelText("Care connections"));
    await waitFor(() =>
      expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
        expect.objectContaining({
          include_care: true,
          up_depth: 2,
          down_depth: 2,
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(await screen.findByLabelText("Historical partnerships"));
    await waitFor(() =>
      expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
        expect.objectContaining({ include_history: true }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Show more ancestors of Alex (1)",
      }),
    );
    await waitFor(() =>
      expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
        expect.objectContaining({
          up_depth: 3,
          include_care: true,
          include_history: true,
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
  it("unions continuation nodes by ID at identical revision/filter and uses exact token", async () => {
    const initial: FamilyTreeGraphProjection = {
      ...graph([a], 3),
      truncated: true,
      expansion_token: "opaque-server-token",
    };
    vi.mocked(apiClient.getFamilyTreeGraph).mockImplementation(
      async (params) =>
        params?.expansion_token
          ? {
              ...graph([a, b], 3),
              focus_person_id: 1,
              edges: [
                {
                  id: "parent:1",
                  record_id: 1,
                  type: "parent",
                  kind: "adoptive",
                  source_person_id: 2,
                  target_person_id: 1,
                  status: null,
                  start_date: null,
                  end_date: null,
                },
              ],
            }
          : initial,
    );
    mount();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Load more people and relationships",
      }),
    );
    await within(
      screen.getByRole("region", { name: "Relationships" }),
    ).findByRole("button", { name: "Select Disconnected" });
    expect(apiClient.getFamilyTreeGraph).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expansion_token: "opaque-server-token",
        focus_person_id: 1,
        up_depth: 2,
        down_depth: 2,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      within(
        screen.getByRole("region", { name: "Relationships" }),
      ).getAllByRole("button", { name: "Select Alex" }),
    ).toHaveLength(1);
  });
  it("comparison displays ordered typed recorded steps, never a guessed kinship", async () => {
    const compare = vi
      .spyOn(apiClient, "compareFamilyTreePeople")
      .mockResolvedValue({
        graph_revision: 3,
        person_a_id: 1,
        person_b_id: 2,
        state: "connected",
        distance: 1,
        person_ids: [1, 2],
        path: [
          {
            id: "care:9",
            record_id: 9,
            type: "care",
            kind: "guardian",
            source_person_id: 2,
            target_person_id: 1,
            status: null,
            start_date: null,
            end_date: null,
          },
        ],
        warnings: [],
        projection_limits: {
          max_nodes: 150,
          max_edges: 300,
          hard_max_nodes: 500,
          hard_max_edges: 1000,
        },
      });
    mount();
    await screen.findByRole("link", { name: "Disconnected" });
    fireEvent.change(screen.getByLabelText("First comparison person"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Second comparison person"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Compare recorded path" }),
    );
    const result = await screen.findByRole("region", {
      name: "Comparison result",
    });
    expect(
      within(result).getByText(/Person 1 → person 2: recorded care · guardian/),
    ).toBeInTheDocument();
    expect(result).not.toHaveTextContent(/genetic|grandparent|cousin/i);
    expect(compare).toHaveBeenCalledWith(
      {
        person_a_id: 1,
        person_b_id: 2,
        include_history: false,
        max_nodes: 150,
        max_edges: 300,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("presents incomplete comparison as bounded/inconclusive instead of disconnected certainty", async () => {
    vi.spyOn(apiClient, "compareFamilyTreePeople").mockResolvedValue({
      graph_revision: 3,
      person_a_id: 1,
      person_b_id: 2,
      state: "truncated",
      distance: null,
      person_ids: [],
      path: [],
      warnings: ["bounded_search"],
      projection_limits: {
        max_nodes: 150,
        max_edges: 300,
        hard_max_nodes: 500,
        hard_max_edges: 1000,
      },
    });
    mount();
    await screen.findByLabelText("First comparison person");
    fireEvent.change(screen.getByLabelText("First comparison person"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Second comparison person"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Compare recorded path" }),
    );
    expect(
      await screen.findByText(
        /Search bound reached; no definitive connection result/,
      ),
    ).toBeInTheDocument();
  });
});
