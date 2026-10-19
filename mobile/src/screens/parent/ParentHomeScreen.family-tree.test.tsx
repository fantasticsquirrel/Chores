import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { ParentHomeScreen } from "./ParentHomeScreen";
import type { TreeRequestOptions } from "../../features/family-tree/lib/workflows/requests";
const session: AuthSessionResponse = {
  user: {
    id: 1,
    household_id: 27,
    email: "qa@example.test",
    role: "PARENT",
    is_household_owner: false,
  },
};
const grant: FamilyModule = {
  key: "family-tree",
  name: "Family Tree",
  description: "History",
  can_manage: false,
};
afterEach(() => {
  jest.restoreAllMocks();
});
describe("Family Tree authoritative lightweight Home shortcut", () => {
  it("aborts the actual Home genealogy request on unmount and rejects a late response", async () => {
    jest
      .spyOn(apiClient, "getMyModules")
      .mockResolvedValue({ modules: [grant] });
    let signal: AbortSignal | undefined;
    let resolve!: (value: unknown) => void;
    const pending = new Promise<unknown>((done) => (resolve = done));
    jest
      .spyOn(apiClient, "getFamilyTreeCollection")
      .mockImplementation((_options?: TreeRequestOptions) => {
        signal = _options?.signal;
        return pending as ReturnType<typeof apiClient.getFamilyTreeCollection>;
      });
    const loaded = jest.fn();
    const view = render(
      <ParentHomeScreen
        session={session}
        modules={[]}
        onModulesLoaded={loaded}
        onNavigate={jest.fn()}
      />,
    );
    await waitFor(() => expect(signal).toBeTruthy());
    view.unmount();
    expect(signal?.aborted).toBe(true);
    resolve({ active_people_count: 7 });
    await pending;
    expect(loaded).toHaveBeenCalledTimes(1);
  });
  it.each([0, 3])(
    "loads collection only after module success and routes actual count %s",
    async (count) => {
      jest
        .spyOn(apiClient, "getMyModules")
        .mockResolvedValue({ modules: [grant] });
      const get = jest
        .spyOn(apiClient, "getFamilyTreeCollection")
        .mockResolvedValue({ active_people_count: count } as never);
      const navigate = jest.fn();
      render(
        <ParentHomeScreen
          session={session}
          modules={[]}
          onModulesLoaded={jest.fn()}
          onNavigate={navigate}
        />,
      );
      fireEvent.press(
        await screen.findByRole("button", {
          name: count === 0 ? "Start your family tree" : "Open family tree",
        }),
      );
      expect(get).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("family-tree");
      expect(screen.queryByText(/ancestor anniversary/i)).toBeNull();
    },
  );
  it("does not read genealogy on discovery error or disabled response despite stale props", async () => {
    jest
      .spyOn(apiClient, "getMyModules")
      .mockRejectedValueOnce(new Error("module discovery failed"))
      .mockResolvedValue({ modules: [] });
    const get = jest.spyOn(apiClient, "getFamilyTreeCollection");
    render(
      <ParentHomeScreen
        session={session}
        modules={[grant]}
        onModulesLoaded={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );
    await screen.findByText("module discovery failed");
    expect(get).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Open family tree" }),
    ).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(apiClient.getMyModules).toHaveBeenCalledTimes(2),
    );
    expect(get).not.toHaveBeenCalled();
  });
});
