import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { AuthSessionResponse } from "../../../api/models";
const mockStart = jest.fn<() => Promise<void>>().mockResolvedValue();
const mockDispose = jest.fn();
const mockRefresh = jest.fn();
const mockInstances: Array<{ options: { modules: () => unknown[]; onNavigate: (tab: string) => void } }> = [];
jest.mock("./nativePushController", () => ({ NativePushController: class {
 state = {status: "off", busy: false, message: "Off"}; start = mockStart; dispose = mockDispose; enable = jest.fn(); disable = jest.fn(); refresh = mockRefresh;
 constructor(options: { modules: () => unknown[]; onNavigate: (tab: string) => void }) { mockInstances.push({options}); }
} }));
jest.mock("./nativePushRuntime", () => ({loadNativePushRuntime: jest.fn()}));
import { useNativePush } from "./useNativePush";
const session: AuthSessionResponse = { user: {id: 1, household_id: 2, role: "PARENT", email: "test@example.test", is_household_owner: false} };
afterEach(() => { jest.clearAllMocks(); mockInstances.length = 0; });
describe("shell-owned native push lifetime", () => {
 it("binds explicit refresh to the current shell controller only", () => {
  const view=renderHook(()=>useNativePush(session,[],jest.fn()));
  act(()=>view.result.current.refresh());expect(mockRefresh).toHaveBeenCalledTimes(1);
  view.unmount();act(()=>view.result.current.refresh());expect(mockRefresh).toHaveBeenCalledTimes(1);
 });
 it("does not start while signed out, retains across tab callback/grant changes and disposes on same-user session replacement", async () => {
  const navigate = jest.fn();
  const view = renderHook(({actor, modules, onNavigate}: {actor: AuthSessionResponse | null; modules: never[]; onNavigate: typeof navigate}) => useNativePush(actor, modules, onNavigate), { initialProps: {actor: null, modules: [], onNavigate: navigate} });
  expect(mockStart).not.toHaveBeenCalled();
  view.rerender({actor: session, modules: [], onNavigate: navigate}); await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  const newer = jest.fn(); view.rerender({actor: session, modules: [], onNavigate: newer});
  act(() => mockInstances[0].options.onNavigate("notifications")); expect(newer).toHaveBeenCalledWith("notifications"); expect(mockDispose).not.toHaveBeenCalled();
  view.rerender({actor: {...session}, modules: [], onNavigate: newer}); expect(mockDispose).toHaveBeenCalledTimes(1); expect(mockStart).toHaveBeenCalledTimes(2);
  view.rerender({actor: null, modules: [], onNavigate: newer}); expect(mockDispose).toHaveBeenCalledTimes(2);
  view.unmount(); expect(mockDispose).toHaveBeenCalledTimes(2);
 });
});
