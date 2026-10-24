import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import { ParentChoresPage } from "./ParentChoresPage";
import { ParentChildrenPage } from "./ParentChildrenPage";

const base: AuthContextValue = {
  status: "authenticated",
  user: {
    id: 1,
    household_id: 1,
    role: "PARENT",
    child_id: null,
    email: "parent@example.com",
    is_household_owner: false,
  },
  moduleKeys: ["chores"],
  manageableModuleKeys: ["chores"],
  setAuthenticatedSession: () => undefined,
  clearSession: () => undefined,
  refreshModuleAccess: async () => undefined,
  logout: async () => undefined,
};
beforeEach(() => {
  vi.spyOn(apiClient, "listChildren").mockResolvedValue([
    { id: 1, household_id: 1, name: "Riley", active: true, has_login: true },
  ]);
  vi.spyOn(apiClient, "listChores").mockResolvedValue([]);
  vi.spyOn(apiClient, "listMyParentTasks").mockResolvedValue([]);
  vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
});
function View({
  manage,
  children,
  path = "/parent/chores",
}: {
  manage: boolean;
  children: React.ReactNode;
  path?: string;
}) {
  return (
    <AuthContext.Provider
      value={{ ...base, manageableModuleKeys: manage ? ["chores"] : [] }}
    >
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </AuthContext.Provider>
  );
}
it("does not mount a view-only chore editor even with a direct editor URL", async () => {
  render(
    <View manage={false} path="/parent/chores?editor=new">
      <ParentChoresPage />
    </View>,
  );
  await screen.findByText("Riley’s chores");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add Chore" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("closes open chore and account portals immediately when management access is revoked", async () => {
  const chore = render(
    <View manage>
      <ParentChoresPage />
    </View>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Add Chore" }));
  expect(await screen.findByRole("dialog")).toBeVisible();
  chore.rerender(
    <View manage={false}>
      <ParentChoresPage />
    </View>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  chore.unmount();
  const child = render(
    <View manage>
      <ParentChildrenPage />
    </View>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Manage login for Riley" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Child account tools" }),
  ).toBeVisible();
  child.rerender(
    <View manage={false}>
      <ParentChildrenPage />
    </View>,
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
