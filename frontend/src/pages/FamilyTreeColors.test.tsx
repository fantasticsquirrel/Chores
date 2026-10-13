import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FamilyTreePage } from "./FamilyTreePage";
import { apiClient } from "../api";
import { AuthContext, type AuthContextValue } from "../auth/context";
import { adult, collection, graph, person } from "../features/family-tree/forms/testFixtures";

const record = { ...person(), birth_date: { value: "1984", precision: "year" as const, uncertain: false } };
const auth: AuthContextValue = {
  status: "authenticated", user: adult,
  moduleKeys: ["family-tree"], manageableModuleKeys: ["family-tree"],
  refreshModuleAccess: vi.fn(), setAuthenticatedSession: vi.fn(),
  clearSession: vi.fn(), logout: vi.fn(),
};
const mount = () => render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter><FamilyTreePage /></MemoryRouter>
  </AuthContext.Provider>,
);
const accent = () => screen.getByRole("article", { name: "Alex" }).style.getPropertyValue("--family-tree-accent-light");
async function customize() {
  await screen.findByRole("article", { name: "Alex" });
  fireEvent.click(screen.getByText("Birth-band colors"));
  fireEvent.change(screen.getByLabelText("Accent for birth band 1975–1999"), { target: { value: "#abcdef" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
  expect(accent()).toBe("#abcdef");
}
beforeEach(() => {
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [{ key: "family-tree", can_manage: true }] } as Awaited<ReturnType<typeof apiClient.getMyModules>>);
  vi.spyOn(apiClient, "getFamilyTreeCollection").mockResolvedValue(collection());
  vi.spyOn(apiClient, "listFamilyTreePeople").mockResolvedValue({ graph_revision: 1, items: [record], total: 1, next_cursor: null });
  vi.spyOn(apiClient, "getFamilyTreeGraph").mockResolvedValue(graph([record]));
});
afterEach(() => vi.restoreAllMocks());

describe("web page presentation ownership", () => {
  it("retains colors while network discovery hides the workspace, but clears on affirmative denial", async () => {
    mount();
    await customize();
    vi.mocked(apiClient.getMyModules).mockRejectedValueOnce(new Error("Network unavailable"));
    fireEvent.focus(window);
    fireEvent.click(await screen.findByRole("button", { name: "Retry access check" }));
    await screen.findByRole("article", { name: "Alex" });
    expect(accent()).toBe("#abcdef");
    vi.mocked(apiClient.getMyModules).mockResolvedValueOnce({ modules: [] });
    fireEvent.focus(window);
    fireEvent.click(await screen.findByRole("button", { name: "Check access again" }));
    await screen.findByRole("article", { name: "Alex" });
    expect(accent()).not.toBe("#abcdef");
  });
  it("retires preferences on household/session ownership replacement", async () => {
    const view = mount();
    await customize();
    const nextAuth = { ...auth, user: { ...adult, household_id: 88 } };
    view.rerender(
      <AuthContext.Provider value={nextAuth}>
        <MemoryRouter><FamilyTreePage /></MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(accent()).not.toBe("#abcdef"));
  });
});
