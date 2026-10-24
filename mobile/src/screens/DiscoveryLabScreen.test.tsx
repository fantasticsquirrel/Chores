import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { StrictMode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { DiscoveryLabScreen } from "./DiscoveryLabScreen";
import { apiClient } from "../api/client";
import type { AuthSessionResponse, FamilyModule } from "../api/models";
import type { DiscoveryExploration } from "@family-manager/family-api/models/discovery-lab";
const item: DiscoveryExploration = {
  id: "gravity",
  title: "Gravity lab",
  summary: "Drop two masses",
  subject: "Physics",
  grade_bands: ["3-5"],
  tags: ["gravity"],
  duration_minutes: 10,
  question: "What falls faster?",
  explanation: "Mass does not change acceleration in a vacuum.",
  experiments: [],
  misconception: "Air changes the result.",
  sources: [],
};
const session = {
  user: { id: 1, household_id: 1, role: "PARENT_ADMIN" },
} as AuthSessionResponse;
const modules = [{ key: "discovery-lab", can_manage: true }] as FamilyModule[];
afterEach(() => {
  jest.restoreAllMocks();
});
function mocks() {
  jest.spyOn(apiClient, "listDiscoveryExplorations").mockResolvedValue([item]);
  jest
    .spyOn(apiClient, "listDiscoveryChildren")
    .mockResolvedValue([{ id: 2, name: "Alex", active: true }]);
}
describe("native Discovery Lab", () => {
  it("makes no request without a module grant", () => {
    const list = jest.spyOn(apiClient, "listDiscoveryExplorations");
    const view = render(<DiscoveryLabScreen session={session} modules={[]} />);
    expect(
      view.getByText("Discovery Lab is not enabled for this account."),
    ).toBeTruthy();
    expect(list).not.toHaveBeenCalled();
  });
  it("loads authoritative detail and changes a physical outcome", async () => {
    mocks();
    jest.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue(item);
    const view = render(
      <DiscoveryLabScreen session={session} modules={modules} />,
    );
    fireEvent.press(await view.findByText("Explore Gravity lab"));
    await view.findByText("Reset experiment");
    expect(apiClient.getDiscoveryExploration).toHaveBeenCalledWith("gravity");
    fireEvent.press(view.getByText("Increase Time (tenths of seconds)"));
    expect(view.getByText(/Masses 1 kg and 3 kg fall 0.2 m/)).toBeTruthy();
    fireEvent.press(view.getByText("Back to Explorations"));
    expect(view.getByText("Explore Gravity lab")).toBeTruthy();
  });
  it("scopes bulk and individual changes to selected child and matching IDs", async () => {
    mocks();
    jest.spyOn(apiClient, "getDiscoveryChildAccess").mockResolvedValue({
      child_id: 2,
      default_enabled: true,
      explorations: [{ ...item, enabled: true, override: null }],
    });
    const update = jest
      .spyOn(apiClient, "updateDiscoveryChildAccess")
      .mockResolvedValue({
        child_id: 2,
        default_enabled: true,
        explorations: [{ ...item, enabled: false, override: false }],
      });
    const view = render(
      <DiscoveryLabScreen session={session} modules={modules} />,
    );
    await view.findByText("Explore Gravity lab");
    fireEvent.press(view.getByText("Manage child access"));
    fireEvent.press(view.getByText("Alex"));
    fireEvent.press(await view.findByText("Disable 1 matching Explorations"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(2, {
        enabled: false,
        exploration_ids: ["gravity"],
      }),
    );
    expect(await view.findByText("Enable Gravity lab")).toBeTruthy();
  });
  it("binds published-package approval to the displayed version", async () => {
    mocks();
    const published = {
      ...item,
      package: {
        version: "1.2.0",
        runtime: "worker-v1" as const,
        checksum: "a".repeat(64),
      },
    };
    jest.spyOn(apiClient, "getDiscoveryChildAccess").mockResolvedValue({
      child_id: 2,
      default_enabled: true,
      explorations: [{ ...published, enabled: false, override: null }],
    });
    const update = jest
      .spyOn(apiClient, "updateDiscoveryChildAccess")
      .mockResolvedValue({
        child_id: 2,
        default_enabled: true,
        explorations: [{ ...published, enabled: true, override: true }],
      });
    const view = render(
      <DiscoveryLabScreen session={session} modules={modules} />,
    );
    await view.findByText("Explore Gravity lab");
    fireEvent.press(view.getByText("Manage child access"));
    fireEvent.press(view.getByText("Alex"));
    await view.findByText(/Web-only Exploration · Version 1.2.0/);
    fireEvent.press(view.getByText("Enable Gravity lab"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(2, {
        enabled: true,
        exploration_ids: ["gravity"],
        package_versions: { gravity: "1.2.0" },
      }),
    );
  });
  it("hides parent management from children and shows denied detail safely", async () => {
    mocks();
    jest
      .spyOn(apiClient, "getDiscoveryExploration")
      .mockRejectedValue(new Error("Exploration is not enabled."));
    const child = {
      user: { id: 3, household_id: 1, role: "CHILD" },
    } as AuthSessionResponse;
    const view = render(
      <DiscoveryLabScreen session={child} modules={modules} />,
    );
    fireEvent.press(await view.findByText("Explore Gravity lab"));
    expect(await view.findByText("Exploration is not enabled.")).toBeTruthy();
    expect(view.queryByText("Manage child access")).toBeNull();
    expect(view.queryByText("Reset experiment")).toBeNull();
    expect(apiClient.listDiscoveryChildren).not.toHaveBeenCalled();
  });
});

it("reloads a StrictMode mount and clears a detail on app resume", async () => {
  mocks();
  let changed: ((state: AppStateStatus) => void) | undefined;
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      changed = listener;
      return { remove: jest.fn() };
    });
  jest.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue(item);
  const view = render(
    <StrictMode>
      <DiscoveryLabScreen session={session} modules={modules} />
    </StrictMode>,
  );
  fireEvent.press(await view.findByText("Explore Gravity lab"));
  await view.findByText("Reset experiment");
  await act(async () => {
    changed?.("active");
  });
  expect(view.queryByText("Reset experiment")).toBeNull();
  expect(await view.findByText("Explore Gravity lab")).toBeTruthy();
});

it("keeps the accepted child-access result after duplicate taps", async () => {
  mocks();
  let resolve: (
    value: Awaited<ReturnType<typeof apiClient.getDiscoveryChildAccess>>,
  ) => void = () => undefined;
  const access = jest
    .spyOn(apiClient, "getDiscoveryChildAccess")
    .mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  const view = render(
    <DiscoveryLabScreen session={session} modules={modules} />,
  );
  await view.findByText("Explore Gravity lab");
  fireEvent.press(view.getByText("Manage child access"));
  const child = view.getByText("Alex");
  act(() => {
    fireEvent.press(child);
    fireEvent.press(child);
  });
  await act(async () => {
    resolve({
      child_id: 2,
      default_enabled: true,
      explorations: [{ ...item, enabled: true, override: null }],
    });
  });
  expect(access).toHaveBeenCalledTimes(1);
  expect(await view.findByText("Disable 1 matching Explorations")).toBeTruthy();
});
