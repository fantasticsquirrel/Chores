import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { ParentHomeScreen } from "./ParentHomeScreen";

jest.mock("../../utils/date", () => ({ todayDateString: () => "2026-10-04" }));
const session: AuthSessionResponse = { user: { id: 1, household_id: 27, email: "parent@example.com", role: "PARENT", is_household_owner: true } };
const chores: FamilyModule = { key: "chores", name: "Chores", description: "Chores", can_manage: true };
const homeschool: FamilyModule = { key: "homeschool", name: "Homeschool", description: "School" };
const recipes: FamilyModule = { key: "recipes", name: "Recipes", description: "Cookbook" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function arrange(modules: FamilyModule[] = [chores, homeschool, recipes]) {
  jest.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules });
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([
    { id: 3, name: "Mia", household_id: 27, active: true },
    { id: 4, name: "Leo", household_id: 27, active: true },
    { id: 5, name: "Inactive", household_id: 27, active: false },
  ]);
  jest.spyOn(apiClient, "listSubmissions").mockResolvedValue([{ id: 8, child_id: 3, child_name: "Mia", for_date: "2026-10-04", status: "PENDING", items: [] }]);
  jest.spyOn(apiClient, "listChildBalances").mockResolvedValue([
    { child_id: 3, child_name: "Mia", balance_cents: 1250 },
    { child_id: 4, child_name: "Leo", balance_cents: 300 },
  ]);
  jest.spyOn(apiClient, "listEligibleChores").mockImplementation(async ({ child_id }) => child_id === 3 ? [{ chore_id: 1, name: "Dishes", reward_cents: 100, occurrence_date: "2026-10-04" }] : []);
}
describe("ParentHomeScreen actionable queue", () => {
  beforeEach(() => arrange());
  afterEach(() => {jest.restoreAllMocks();});
  it("loads the authoritative household snapshot and routes every website-equivalent action", async () => {
    const loaded = jest.fn(); const navigate = jest.fn();
    render(<ParentHomeScreen modules={[]} onModulesLoaded={loaded} onNavigate={navigate} session={session} />);
    expect(await screen.findByText("Total amount owed")).toBeTruthy();
    expect(await screen.findByText("$15.50")).toBeTruthy();
    expect(screen.getByText("Mia · 1 chore due")).toBeTruthy();
    expect(screen.getByText("Leo · 0 chores due")).toBeTruthy();
    expect(screen.queryByText(/Inactive ·/)).toBeNull();
    expect(apiClient.listChildren).toHaveBeenCalledWith({ household_id: 27, active_only: true });
    expect(apiClient.listEligibleChores).toHaveBeenCalledWith({ child_id: 3, date: "2026-10-04" });
    expect(apiClient.listEligibleChores).toHaveBeenCalledWith({ child_id: 4, date: "2026-10-04" });
    expect(apiClient.listEligibleChores).toHaveBeenCalledTimes(2);
    expect(apiClient.listSubmissions).toHaveBeenCalledWith({ status: "PENDING" });
    expect(loaded).toHaveBeenCalledWith([chores, homeschool, recipes]);
    for (const [label, tab] of [["Review 1 submission", "review"], ["Manage Children", "children"], ["Open Board", "review"], ["Money & History", "money"], ["Open Homeschool", "homeschool"], ["Open Cookbook", "recipes"]]) {
      fireEvent.press(screen.getByRole("button", { name: label })); expect(navigate).toHaveBeenLastCalledWith(tab);
    }
    fireEvent.press(screen.getAllByRole("button", { name: "Open Chores" })[0]); expect(navigate).toHaveBeenLastCalledWith("chores");
  });
  it("publishes revoked modules before avoiding every gated API even with stale props", async () => {
    jest.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [homeschool] });
    const loaded = jest.fn();
    render(<ParentHomeScreen modules={[chores]} onModulesLoaded={loaded} session={session} />);
    await waitFor(() => expect(loaded).toHaveBeenCalledWith([homeschool]));
    expect(apiClient.listChildren).not.toHaveBeenCalled(); expect(apiClient.listSubmissions).not.toHaveBeenCalled(); expect(apiClient.listChildBalances).not.toHaveBeenCalled(); expect(apiClient.listEligibleChores).not.toHaveBeenCalled();
    expect(screen.queryByText("Active children")).toBeNull(); expect(screen.queryByText("Manage Children")).toBeNull(); expect(screen.queryByText("Open Cookbook")).toBeNull();
  });
  it("publishes modules even when snapshot loading fails and retries with Refresh", async () => {
    jest.mocked(apiClient.listChildBalances).mockRejectedValueOnce(new Error("balances unavailable"));
    const loaded = jest.fn();
    render(<ParentHomeScreen modules={[chores]} onModulesLoaded={loaded} session={session} />);
    expect(await screen.findByText(/balances unavailable/)).toBeTruthy(); expect(loaded).toHaveBeenCalledWith([chores, homeschool, recipes]);
    fireEvent.press(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("$15.50")).toBeTruthy(); expect(screen.queryByText(/balances unavailable/)).toBeNull();
  });
  it("keeps view-only Home free of review mutations", async () => {
    jest.mocked(apiClient.getMyModules).mockResolvedValue({ modules: [{ ...chores, can_manage: false }] });
    const approve = jest.spyOn(apiClient, "approveSubmission"); const create = jest.spyOn(apiClient, "createChoreTransaction");
    render(<ParentHomeScreen modules={[chores]} onModulesLoaded={jest.fn()} onNavigate={jest.fn()} session={session} />);
    await screen.findByText("$15.50");
    expect(screen.queryByRole("button", { name: "Review 1 submission" })).toBeNull(); expect(screen.getByRole("button", { name: "View Children" })).toBeTruthy();
    expect(approve).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it("discards old household results when the session changes", async () => {
    const oldChildren = deferred<Awaited<ReturnType<typeof apiClient.listChildren>>>();
    jest.mocked(apiClient.listChildren).mockImplementationOnce(() => oldChildren.promise);
    const loaded = jest.fn();
    const view = render(<ParentHomeScreen modules={[chores]} onModulesLoaded={loaded} session={session} />);
    await waitFor(() => expect(apiClient.listChildren).toHaveBeenCalledTimes(1));
    view.rerender(<ParentHomeScreen modules={[chores]} onModulesLoaded={loaded} session={{ ...session, user: { ...session.user, household_id: 99 } }} />);
    await screen.findByText("$15.50");
    await act(async () => oldChildren.resolve([{ id: 99, name: "Old household", household_id: 27, active: true }]));
    expect(screen.queryByText(/Old household/)).toBeNull(); expect(apiClient.listEligibleChores).not.toHaveBeenCalledWith({ child_id: 99, date: "2026-10-04" });
  });
  it("does not publish modules or start household calls after unmount", async () => {
    const response = deferred<Awaited<ReturnType<typeof apiClient.getMyModules>>>();
    jest.mocked(apiClient.getMyModules).mockReturnValueOnce(response.promise);
    const loaded = jest.fn(); const view = render(<ParentHomeScreen modules={[chores]} onModulesLoaded={loaded} session={session} />);
    view.unmount(); await act(async () => response.resolve({ modules: [chores] }));
    expect(loaded).not.toHaveBeenCalled(); expect(apiClient.listChildren).not.toHaveBeenCalled();
  });
});
