import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";
import { apiClient } from "../../api";

vi.mock("./simulations/ExplorationSimulation", () => ({
  ExplorationSimulation: () => (
    <input
      type="range"
      aria-label="Test experiment control"
      min="0"
      max="10"
      defaultValue="3"
    />
  ),
}));
const exploration = {
  id: "gravity",
  title: "Gravity lab",
  subject: "Physics",
  grade_bands: ["3-5"],
  tags: ["motion"],
  duration_minutes: 10,
  summary: "Try gravity.",
  question: "What falls?",
  explanation: "Objects accelerate.",
  experiments: [],
  misconception: "Mass does not set falling acceleration in vacuum.",
  sources: [],
};
function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe("Discovery routes", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue(
      exploration,
    );
    vi.spyOn(apiClient, "listDiscoveryExplorations").mockResolvedValue([
      exploration,
    ]);
    vi.spyOn(apiClient, "listDiscoveryChildren").mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());
  it("blocks a direct disabled-module URL without fetching its content", async () => {
    open("/discovery-lab/gravity");
    expect(
      await screen.findByRole("heading", { name: "Module Not Available" }),
    ).toBeVisible();
    expect(apiClient.getDiscoveryExploration).not.toHaveBeenCalled();
  });
  it("keeps local simulation inputs interactive for view-only accounts", async () => {
    vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
      modules: [
        {
          key: "discovery-lab",
          name: "Discovery Lab",
          description: "",
          can_manage: false,
        },
      ],
    });
    open("/discovery-lab/gravity");
    const slider = await screen.findByRole("slider", {
      name: "Test experiment control",
    });
    expect(slider).toBeEnabled();
    expect(document.querySelector(".module-read-only")).toBeNull();
    fireEvent.change(slider, { target: { value: "7" } });
    expect(slider).toHaveValue("7");
  });
  it("does not fetch settings from a direct parent view-only settings URL", async () => {
    vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
      modules: [
        {
          key: "discovery-lab",
          name: "Discovery Lab",
          description: "",
          can_manage: false,
        },
      ],
    });
    open("/discovery-lab/manage");
    expect(
      await screen.findByText(
        "Only parents with management access can change Explorations.",
      ),
    ).toBeVisible();
    expect(apiClient.listDiscoveryChildren).not.toHaveBeenCalled();
    expect(apiClient.getDiscoveryExploration).not.toHaveBeenCalled();
  });
  it("offers an enabled child the module navigation and exploration route", async () => {
    vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
      user: {
        id: 7,
        household_id: 1,
        email: "child@example.com",
        role: "CHILD",
        is_household_owner: false,
        child_id: 7,
      },
      csrf_token: null,
    });
    vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
      modules: [
        {
          key: "discovery-lab",
          name: "Discovery Lab",
          description: "",
          can_manage: false,
        },
      ],
    });
    open("/discovery-lab");
    expect(
      await screen.findByRole("link", { name: /Gravity lab/ }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Discovery Lab" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Choose Explorations/ }),
    ).not.toBeInTheDocument();
  });
});
