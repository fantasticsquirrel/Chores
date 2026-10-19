import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { apiClient } from "./api/client";
import { AppShell } from "./AppShell";
import { useModules } from "./hooks/useModules";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("./hooks/useModules");
jest.mock("./hooks/useSessionBootstrap");
jest.mock("./features/notifications/lib/useNativePush", () => ({
  useNativePush: () => null,
}));
const grant = {
  key: "family-tree" as const,
  name: "Family Tree",
  description: "History",
  can_manage: false,
};
const parent = {
  user: {
    id: 1,
    email: "qa@example.test",
    role: "PARENT" as const,
    household_id: 27,
    is_household_owner: false,
  },
};
const publish = jest.fn();
function arrange(role: "PARENT" | "CHILD" = "PARENT") {
  jest
    .mocked(useModules)
    .mockReturnValue({
      modules: [grant],
      loadModules: jest
        .fn<() => Promise<(typeof grant)[]>>()
        .mockResolvedValue([grant]),
      setModules: publish,
    });
  const currentSession = { ...parent, user: { ...parent.user, role } };
  jest.mocked(useSessionBootstrap).mockImplementation(() => {
    const React = require("react");
    const [activeTab, setActiveTab] = React.useState("home");
    return {
      activeTab,
      setActiveTab,
      bootstrapping: false,
      bootstrapError: null,
      session: currentSession,
      handleParentLogin: jest.fn(),
      handleChildLogin: jest.fn(),
      handleLogout: jest.fn(),
      clearSession: jest.fn(),
    } as never;
  });
}
beforeEach(() => {
  jest.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [grant] });
  jest
    .spyOn(apiClient, "getFamilyTreeCollection")
    .mockResolvedValue({
      state: "uninitialized",
      collection_id: null,
      title: "Family Tree",
      graph_revision: 0,
      default_focus_person_id: null,
      active_people_count: 0,
      archived_people_count: 0,
      capabilities: { can_manage: false, can_export: false, can_purge: false },
    });
  jest
    .spyOn(apiClient, "listFamilyTreePeople")
    .mockResolvedValue({
      graph_revision: 0,
      items: [],
      total: 0,
      next_cursor: null,
    });
  jest
    .spyOn(apiClient, "getFamilyTreeGraph")
    .mockResolvedValue({
      graph_revision: 0,
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
    });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
describe("actual More/Home/Family Tree shell composition", () => {
  it("opens actual native tree from More without permanent primary tab", async () => {
    arrange();
    render(<AppShell />);
    await screen.findByRole("button", { name: "More" });
    expect(screen.queryByRole("button", { name: "Family Tree" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "More" }));
    fireEvent.press(await screen.findByRole("button", { name: "Family Tree" }));
    await screen.findByText("View-only Family Tree");
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(apiClient.listFamilyTreePeople).toHaveBeenCalled(),
    );
    expect(publish).toHaveBeenCalledWith([grant]);
  });
  it("routes the lightweight Home shortcut to the same actual screen", async () => {
    arrange();
    render(<AppShell />);
    fireEvent.press(
      await screen.findByRole("button", { name: "Start your family tree" }),
    );
    await screen.findByText("View-only Family Tree");
  });
  it("never exposes Family Tree to a child even with a stray grant", async () => {
    arrange("CHILD");
    render(<AppShell />);
    expect(screen.queryByRole("button", { name: "Family Tree" })).toBeNull();
    expect(apiClient.getFamilyTreeCollection).not.toHaveBeenCalled();
    expect(apiClient.listFamilyTreePeople).not.toHaveBeenCalled();
  });
});
