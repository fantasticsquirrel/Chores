import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiClient } from "../../api";
import { AuthContext, type AuthContextValue } from "../../auth/context";
import {
  DiscoveryLabPage,
  DiscoveryExplorationPage,
  DiscoveryAccessPage,
} from "../../pages/DiscoveryLabPage";

vi.mock("./simulations/ExplorationSimulation", () => ({
  ExplorationSimulation: ({ explorationId }: { explorationId: string }) => (
    <div data-testid="simulation">{explorationId}</div>
  ),
}));

const orbit = {
  id: "orbital-mechanics",
  title: "The art of falling sideways",
  subject: "Physics",
  grade_bands: ["6-8"],
  tags: ["space", "motion"],
  duration_minutes: 15,
  summary: "Launch a satellite and investigate its path.",
  question: "How does a satellite stay up?",
  explanation: "Gravity continually bends its path.",
  experiments: [
    {
      title: "Find an orbit",
      instruction: "Change launch speed.",
      observe: "Look for a closed path.",
    },
  ],
  misconception: "Orbit is not zero gravity.",
  sources: [{ title: "NASA", url: "https://science.nasa.gov/" }],
};
const leaf = {
  ...orbit,
  id: "photosynthesis",
  title: "Inside a leaf",
  subject: "Biology",
  grade_bands: ["3-5"],
  tags: ["plants"],
  summary: "Explore how plants make sugar.",
};
const context: AuthContextValue = {
  status: "authenticated",
  user: {
    id: 1,
    household_id: 1,
    email: "parent@example.com",
    role: "PARENT",
    is_household_owner: false,
    child_id: null,
  },
  moduleKeys: ["discovery-lab"],
  manageableModuleKeys: ["discovery-lab"],
  setAuthenticatedSession: vi.fn(),
  refreshModuleAccess: vi.fn(),
  clearSession: vi.fn(),
  logout: vi.fn(),
};
function show(path = "/discovery-lab", auth = context) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discovery-lab" element={<DiscoveryLabPage />} />
          <Route
            path="/discovery-lab/manage"
            element={<DiscoveryAccessPage />}
          />
          <Route
            path="/discovery-lab/:explorationId"
            element={<DiscoveryExplorationPage />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
describe("Discovery Lab", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listDiscoveryPackages").mockResolvedValue([]);
    vi.spyOn(apiClient, "listDiscoveryExplorations").mockResolvedValue([
      orbit,
      leaf,
    ]);
    vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue(orbit);
    vi.spyOn(apiClient, "listDiscoveryChildren").mockResolvedValue([
      { id: 7, name: "Robin", active: true },
    ]);
    vi.spyOn(apiClient, "getDiscoveryChildAccess").mockResolvedValue({
      child_id: 7,
      default_enabled: true,
      explorations: [
        { ...orbit, enabled: true, override: null },
        { ...leaf, enabled: true, override: null },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());
  it("groups independently approved package alternatives without redirecting original bookmarks", async () => {
    vi.mocked(apiClient.listDiscoveryExplorations).mockResolvedValue([
      orbit,
      {
        ...orbit,
        id: "orbital-mechanics-package",
        package: {
          version: "1.0.0",
          runtime: "worker-rich-v1",
          checksum: "test",
        },
      },
    ]);
    show();
    expect(
      await screen.findByRole("link", {
        name: /Open downloaded version 1.0.0/,
      }),
    ).toHaveAttribute("href", "/discovery-lab/orbital-mechanics-package");
    expect(
      screen.getByRole("link", { name: /The art of falling sideways/ }),
    ).toHaveAttribute("href", "/discovery-lab/orbital-mechanics");
    expect(document.querySelectorAll(".discovery-card")).toHaveLength(1);
  });
  it("browses, searches and resets without losing the complete filter vocabulary", async () => {
    show();
    expect(
      await screen.findByRole("link", { name: /The art of falling sideways/ }),
    ).toBeVisible();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Find an exploration" }),
      { target: { value: "leaf" } },
    );
    expect(
      screen.queryByRole("link", { name: /The art of falling sideways/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inside a leaf/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(
      screen.getByRole("link", { name: /The art of falling sideways/ }),
    ).toBeVisible();
  });
  it("renders guided exploration and code simulation after authoritative detail read", async () => {
    show("/discovery-lab/orbital-mechanics");
    expect(
      await screen.findByRole("heading", { name: orbit.title }),
    ).toBeVisible();
    expect(screen.getByTestId("simulation")).toHaveTextContent(
      "orbital-mechanics",
    );
    expect(screen.getByText(orbit.misconception)).toBeVisible();
    expect(apiClient.getDiscoveryExploration).toHaveBeenCalledWith(
      "orbital-mechanics",
    );
  });
  it("does not mount a simulation when direct access is denied", async () => {
    vi.mocked(apiClient.getDiscoveryExploration).mockRejectedValue(
      new Error("Exploration access denied."),
    );
    show("/discovery-lab/orbital-mechanics");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Exploration access denied.",
    );
    expect(screen.queryByTestId("simulation")).not.toBeInTheDocument();
  });
  it("applies the filtered group to the selected child and prevents duplicate writes", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof apiClient.getDiscoveryChildAccess>>,
    ) => void;
    const update = vi
      .spyOn(apiClient, "updateDiscoveryChildAccess")
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    show("/discovery-lab/manage");
    await screen.findByRole("checkbox", { name: `Enable ${orbit.title}` });
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Biology" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off 1 matching exploration" }),
    );
    expect(update).toHaveBeenCalledWith(7, {
      enabled: false,
      exploration_ids: ["photosynthesis"],
    });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    resolve({
      child_id: 7,
      default_enabled: true,
      explorations: [
        { ...orbit, enabled: true, override: null },
        { ...leaf, enabled: false, override: false },
      ],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updated 1 exploration for Robin.",
    );
  });
  it("toggles an individual page and keeps its saved state on write failure", async () => {
    vi.spyOn(apiClient, "updateDiscoveryChildAccess").mockRejectedValue(
      new Error("Offline"),
    );
    show("/discovery-lab/manage");
    const checkbox = await screen.findByRole("checkbox", {
      name: `Enable ${orbit.title}`,
    });
    fireEvent.click(checkbox);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(checkbox).toBeChecked();
  });
  it("keeps a completed save after a focus refresh returns older access", async () => {
    const original = {
      child_id: 7,
      default_enabled: true,
      explorations: [{ ...orbit, enabled: true, override: null }],
    };
    let finishRead!: (value: typeof original) => void;
    let finishSave!: (
      value: Awaited<ReturnType<typeof apiClient.getDiscoveryChildAccess>>,
    ) => void;
    vi.mocked(apiClient.getDiscoveryChildAccess)
      .mockResolvedValueOnce(original)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRead = resolve;
          }),
      );
    vi.spyOn(apiClient, "updateDiscoveryChildAccess").mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    show("/discovery-lab/manage");
    fireEvent.click(
      await screen.findByRole("checkbox", { name: `Enable ${orbit.title}` }),
    );
    fireEvent.focus(window);
    await waitFor(() =>
      expect(apiClient.getDiscoveryChildAccess).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      finishSave({
        ...original,
        explorations: [{ ...orbit, enabled: false, override: false }],
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updated 1 exploration for Robin.",
    );
    await act(async () => {
      finishRead(original);
    });
    const checkbox = screen.getByRole("checkbox", {
      name: `Enable ${orbit.title}`,
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
  });

  it("does not fetch parent settings for a child", async () => {
    show("/discovery-lab/manage", {
      ...context,
      user: { ...context.user!, role: "CHILD", child_id: 7 },
      manageableModuleKeys: [],
    });
    expect(
      await screen.findByText(
        "Only parents with management access can change Explorations.",
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(apiClient.listDiscoveryChildren).not.toHaveBeenCalled(),
    );
  });
  it("shows a useful empty catalog", async () => {
    vi.mocked(apiClient.listDiscoveryExplorations).mockResolvedValue([]);
    show();
    expect(await screen.findByText("No Explorations enabled")).toBeVisible();
  });
});
