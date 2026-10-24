import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient, type Child } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import { ParentDashboardPage } from "./ParentDashboardPage";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const auth: AuthContextValue = {
  user: {
    id: 1,
    household_id: 1,
    email: "parent@example.com",
    role: "PARENT",
    is_household_owner: false,
    child_id: null,
  },
  status: "authenticated",
  moduleKeys: ["chores"],
  manageableModuleKeys: ["chores"],
  setAuthenticatedSession: vi.fn(),
  refreshModuleAccess: async () => {},
  clearSession: vi.fn(),
  logout: async () => {},
};
function page(value: AuthContextValue) {
  return (
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <ParentDashboardPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}
afterEach(() => {
  vi.restoreAllMocks();
});

it("rejects late section results from a previous household", async () => {
  const oldChildren = deferred<Child[]>();
  vi.spyOn(apiClient, "listChildren")
    .mockReturnValueOnce(oldChildren.promise)
    .mockResolvedValue([]);
  vi.spyOn(apiClient, "listSubmissions").mockResolvedValue([]);
  vi.spyOn(apiClient, "listChildBalances").mockResolvedValue([]);
  const eligible = vi.spyOn(apiClient, "listEligibleChores");
  const view = render(page(auth));
  await waitFor(() =>
    expect(apiClient.listChildren).toHaveBeenCalledWith({ household_id: 1 }),
  );
  view.rerender(page({ ...auth, user: { ...auth.user!, household_id: 42 } }));
  await screen.findByText(/All caught up/);
  await act(async () =>
    oldChildren.resolve([
      { id: 7, household_id: 1, name: "Old household child", active: true },
    ]),
  );
  expect(screen.queryByText(/Old household/)).not.toBeInTheDocument();
  expect(eligible).not.toHaveBeenCalled();
  expect(apiClient.listChildren).toHaveBeenCalledWith({ household_id: 42 });
});

it("does not mistake failed approvals or balances for confirmed zeros", async () => {
  vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
  vi.spyOn(apiClient, "listSubmissions").mockRejectedValue(
    new Error("Reviews offline"),
  );
  vi.spyOn(apiClient, "listChildBalances").mockRejectedValue(
    new Error("Money offline"),
  );
  render(page(auth));
  await screen.findByText(/Approvals unavailable/);
  expect(
    screen.getByText("Pending Submissions").parentElement,
  ).toHaveTextContent("Unavailable");
  expect(screen.getByText("Total Amount Owed").parentElement).toHaveTextContent(
    "Unavailable",
  );
  expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  expect(screen.queryByText(/All caught up/)).not.toBeInTheDocument();
});
