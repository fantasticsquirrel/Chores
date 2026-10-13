import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { apiClient } from "../api/client";
import type { AuthSessionResponse, FamilyModule } from "../api/models";
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
import { FamilyTreeScreen } from "./FamilyTreeScreen";

const session: AuthSessionResponse = { user: { id: 1, household_id: 27, email: "test@example.test", role: "PARENT", is_household_owner: false } };
const grant: FamilyModule = { key: "family-tree", name: "Family Tree", description: "History", can_manage: true };
const props = { session, modules: [grant], onModulesLoaded: jest.fn() };
beforeEach(() => {
  jest.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [grant] });
  jest.spyOn(apiClient, "getFamilyTreeCollection").mockResolvedValue({
    state: "initialized", collection_id: 1, title: "Family Tree", graph_revision: 1,
    default_focus_person_id: 1, active_people_count: 1, archived_people_count: 0,
    capabilities: { can_manage: true, can_export: false, can_purge: false },
  });
  jest.spyOn(apiClient, "listFamilyTreePeople").mockResolvedValue({ graph_revision: 1, items: [], total: 0, next_cursor: null });
  jest.spyOn(apiClient, "getFamilyTreeGraph").mockResolvedValue({
    graph_revision: 1, focus_person_id: 1,
    nodes: [{ id: 1, display_name: "Alex", living_status: "unknown", birth_date: { value: "1984", precision: "year", uncertain: false }, death_date: null, is_locked: false, expansion_counts: { parents: 0, children: 0, partners: 0, care: 0 } }],
    edges: [], truncated: false, expansion_token: null, warnings: [],
    projection_limits: { max_nodes: 250, max_edges: 500, hard_max_nodes: 500, hard_max_edges: 1000 },
  });
});
afterEach(() => { jest.restoreAllMocks(); });

describe("native screen presentation ownership", () => {
  it("preserves colors across discovery hiding and management downgrade, retires them on denial", async () => {
    const view = render(<FamilyTreeScreen {...props} />);
    fireEvent.press(await view.findByRole("button", { name: "Show birth-band colors" }));
    fireEvent.changeText(view.getByLabelText("Accent for birth band 1975–1999"), "#abcdef");
    fireEvent.press(view.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    const accent = () => StyleSheet.flatten(view.getByTestId("family-tree-birth-accent-1").props.style).borderLeftColor;
    expect(accent()).toBe("#abcdef");
    jest.mocked(apiClient.getMyModules).mockRejectedValueOnce(new Error("Discovery offline"));
    await waitFor(() => expect(view.getByRole("button", { name: "Refresh" }).props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(view.getByRole("button", { name: "Refresh" })); });
    await waitFor(() => expect(view.queryByTestId("family-tree-birth-accent-1")).toBeNull(), { timeout: 1000 });
    fireEvent.press(await view.findByRole("button", { name: "Retry Family Tree" }));
    await view.findByTestId("family-tree-birth-accent-1");
    expect(accent()).toBe("#abcdef");
    jest.mocked(apiClient.getMyModules).mockResolvedValueOnce({ modules: [{ ...grant, can_manage: false }] });
    await waitFor(() => expect(view.getByRole("button", { name: "Refresh" }).props.accessibilityState.disabled).toBe(false));
    fireEvent.press(view.getByRole("button", { name: "Refresh" }));
    await view.findByText("View-only Family Tree");
    expect(accent()).toBe("#abcdef");
    jest.mocked(apiClient.getMyModules).mockResolvedValueOnce({ modules: [] });
    await waitFor(() => expect(view.getByRole("button", { name: "Refresh" }).props.accessibilityState.disabled).toBe(false));
    await act(async () => { fireEvent.press(view.getByRole("button", { name: "Refresh" })); });
    await waitFor(() => expect(view.queryByTestId("family-tree-birth-accent-1")).toBeNull(), { timeout: 1000 });
    fireEvent.press(await view.findByRole("button", { name: "Retry Family Tree" }));
    await view.findByTestId("family-tree-birth-accent-1");
    expect(accent()).not.toBe("#abcdef");
  });
  it("retires colors on actual household ownership replacement", async () => {
    const view = render(<FamilyTreeScreen {...props} />);
    fireEvent.press(await view.findByRole("button", { name: "Show birth-band colors" }));
    fireEvent.changeText(view.getByLabelText("Accent for birth band 1975–1999"), "#abcdef");
    fireEvent.press(view.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    view.rerender(<FamilyTreeScreen {...props} session={{ user: { ...session.user, household_id: 88 } }} />);
    await view.findByTestId("family-tree-birth-accent-1");
    expect(StyleSheet.flatten(view.getByTestId("family-tree-birth-accent-1").props.style).borderLeftColor).not.toBe("#abcdef");
  });
});
