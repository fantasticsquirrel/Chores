import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { apiClient } from "./api";
import { WEB_MODULE_REGISTRATION } from "./modules/registry";

const user = {
  id: 41,
  household_id: 7,
  role: "PARENT" as const,
  email: "adult@example.test",
  child_id: null,
};
const modules = (manage?: boolean) => ({
  modules: [
    {
      key: "family-tree",
      name: "Family Tree",
      description: "Private family records",
      can_manage: manage,
    },
  ],
});
const empty = {
  state: "uninitialized" as const,
  collection_id: null,
  title: "Family Tree",
  graph_revision: 0,
  default_focus_person_id: null,
  active_people_count: 0,
  archived_people_count: 0,
  capabilities: { can_manage: true, can_export: false, can_purge: false },
};
const mount = (path = "/family-tree") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.spyOn(apiClient, "getCurrentSession").mockResolvedValue({
    user,
  } as Awaited<ReturnType<typeof apiClient.getCurrentSession>>);
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue(
    modules(true) as Awaited<ReturnType<typeof apiClient.getMyModules>>,
  );
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockResolvedValue(empty);
  vi.spyOn(apiClient, "listFamilyTreePeople").mockResolvedValue({
    graph_revision: 0,
    items: [],
    total: 0,
    next_cursor: null,
  });
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockRejectedValue(
    new Error("Unexpected graph load"),
  );
});
afterEach(() => vi.restoreAllMocks());
describe("Family Tree actual shell integration", () => {
  it("registers actual primary/detail routes, module guard and Home card", () => {
    expect(WEB_MODULE_REGISTRATION.routes).toContainEqual({
      moduleKey: "family-tree",
      destination: "/family-tree",
    });
    expect(WEB_MODULE_REGISTRATION.routes).toContainEqual({
      moduleKey: "family-tree",
      destination: "/family-tree/people/:personId",
    });
    expect(WEB_MODULE_REGISTRATION.guards).toContain("family-tree");
    expect(WEB_MODULE_REGISTRATION.dashboardCards).toContain("family-tree");
  });
  it("opens the actual empty first-person workflow at the direct route", async () => {
    mount();
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Add first person" },
        { timeout: 5000 },
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(apiClient.getFamilyTreeGraph).not.toHaveBeenCalled();
  });
  it("makes no genealogy calls until authoritative discovery succeeds", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof apiClient.getMyModules>>,
    ) => void;
    vi.mocked(apiClient.getMyModules).mockReturnValue(
      new Promise((done) => (resolve = done)),
    );
    mount();
    expect(apiClient.getFamilyTreeCollection).not.toHaveBeenCalled();
    expect(apiClient.listFamilyTreePeople).not.toHaveBeenCalled();
    resolve(
      modules(true) as Awaited<ReturnType<typeof apiClient.getMyModules>>,
    );
    await waitFor(() =>
      expect(apiClient.getMyModules).toHaveBeenCalledTimes(2),
    );
    resolve(
      modules(true) as Awaited<ReturnType<typeof apiClient.getMyModules>>,
    );
    expect(
      await screen.findByRole("button", { name: "Add first person" }),
    ).toBeInTheDocument();
  });
  it("never grants child access even if the discovery claims Family Tree", async () => {
    vi.mocked(apiClient.getCurrentSession).mockResolvedValue({
      user: { ...user, role: "CHILD", child_id: 3 },
    } as Awaited<ReturnType<typeof apiClient.getCurrentSession>>);
    vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue([]);
    vi.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    mount();
    await screen.findByText(/Signed in as/);
    expect(apiClient.getFamilyTreeCollection).not.toHaveBeenCalled();
    expect(apiClient.listFamilyTreePeople).not.toHaveBeenCalled();
  });
  it("requires affirmative manage; missing manage remains view-only", async () => {
    vi.mocked(apiClient.getMyModules).mockResolvedValue(
      modules() as Awaited<ReturnType<typeof apiClient.getMyModules>>,
    );
    mount();
    await screen.findByText("Start your family tree");
    expect(
      screen.queryByRole("button", { name: "Add first person" }),
    ).not.toBeInTheDocument();
  });
  it("Home shows a real count-driven Start shortcut, not genealogy tasks", async () => {
    mount("/parent/dashboard");
    expect(
      await screen.findByRole("link", { name: "Start Family Tree" }),
    ).toHaveAttribute("href", "/family-tree");
    expect(screen.getByText(/0 active recorded people/)).toBeInTheDocument();
  });
});
