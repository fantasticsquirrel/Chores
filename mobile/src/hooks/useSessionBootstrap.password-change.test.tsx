import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";

import { apiClient } from "../api/client";
import type { FamilyModule } from "../api/models";
import { ChangePasswordScreen } from "../screens/account/ChangePasswordScreen";
import { useSessionBootstrap } from "./useSessionBootstrap";

const initial = {
  csrf_token: "initial-csrf",
  user: { id: 1, email: "parent@example.test", role: "PARENT" as const, household_id: 1, child_id: null },
};
const nextSession = { ...initial, csrf_token: "new-csrf", user: { ...initial.user, id: 2, email: "next@example.test" } };
const revokedMessage = "Password changed. Sign in again.";
const response = (session = initial): Response => ({
  ok: true, status: 200,
  headers: { get: () => "application/json" }, json: async () => session,
} as unknown as Response);
const noContent = (): Response => ({
  ok: true, status: 204, headers: { get: () => null },
} as unknown as Response);
function submitPassword() {
  fireEvent.changeText(screen.getByPlaceholderText("Current password"), "current-test-password");
  fireEvent.changeText(screen.getByPlaceholderText("At least 15 characters"), "new-test-password-long");
  fireEvent.changeText(screen.getByPlaceholderText("Repeat new password"), "new-test-password-long");
  fireEvent.press(screen.getByText("Update Password"));
}
beforeEach(() => { apiClient.clearAuthentication(); });
afterEach(() => { jest.restoreAllMocks(); apiClient.clearAuthentication(); });

describe("password-change auth controller wiring", () => {
  it("clears the matching revoked session after the password form unmounts", async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = jest.spyOn(apiClient as unknown as { fetchImpl: typeof fetch }, "fetchImpl")
      .mockResolvedValueOnce(response())
      .mockReturnValueOnce(pending);
    const setModules = jest.fn();
    const loadModules = jest.fn<() => Promise<FamilyModule[]>>().mockResolvedValue([]);
    const { result } = renderHook(() => useSessionBootstrap({ loadModules, setModules }));
    await waitFor(() => expect(result.current.bootstrapping).toBe(false));
    act(() => result.current.setActiveTab("account"));
    const view = render(<ChangePasswordScreen onPasswordChanged={() => result.current.clearSession(revokedMessage)} />);
    submitPassword();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    view.unmount();
    await act(async () => { release(noContent()); await pending; });
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.activeTab).toBe("home");
    expect(result.current.bootstrapError).toBe(revokedMessage);
    expect(setModules).toHaveBeenLastCalledWith([]);
  });

  it("preserves a newer queued sign-in instead of clearing or cancelling it", async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = jest.spyOn(apiClient as unknown as { fetchImpl: typeof fetch }, "fetchImpl")
      .mockResolvedValueOnce(response())
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(response(nextSession))
      .mockResolvedValueOnce(noContent());
    const loadModules = jest.fn<() => Promise<[]>>().mockResolvedValue([]);
    const setModules = jest.fn();
    const { result } = renderHook(() => useSessionBootstrap({ loadModules, setModules }));
    await waitFor(() => expect(result.current.bootstrapping).toBe(false));
    act(() => result.current.setActiveTab("account"));
    render(<ChangePasswordScreen onPasswordChanged={() => result.current.clearSession(revokedMessage)} />);
    submitPassword();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    let signIn!: Promise<void | Error>;
    act(() => {
      signIn = result.current.handleParentLogin({ email: nextSession.user.email, password: "fixture-password" })
        .catch((error: Error) => error);
    });
    await act(async () => { release(noContent()); await signIn; });
    expect(await signIn).toBeUndefined();
    expect(result.current.session).toEqual(nextSession);
    expect(result.current.bootstrapError).toBeNull();
    expect(screen.queryByText(revokedMessage)).toBeNull();
    expect(loadModules).toHaveBeenCalledTimes(2);
    expect(setModules).toHaveBeenCalledTimes(1); // New actor cache reset, not stale teardown.
    await apiClient.createRecipe({ title: "QA" });
    expect(fetchMock.mock.calls[3][1]?.headers).toHaveProperty("X-CSRF-Token", "new-csrf");
  });

  it("clears matching actor session, modules, tab and CSRF after success", async () => {
    const fetchMock = jest.spyOn(apiClient as unknown as { fetchImpl: typeof fetch }, "fetchImpl")
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(noContent())
      .mockResolvedValueOnce(noContent());
    const loadModules = jest.fn<() => Promise<[]>>().mockResolvedValue([]);
    const setModules = jest.fn();
    const { result } = renderHook(() => useSessionBootstrap({ loadModules, setModules }));
    await waitFor(() => expect(result.current.bootstrapping).toBe(false));
    act(() => result.current.setActiveTab("account"));
    render(<ChangePasswordScreen onPasswordChanged={() => result.current.clearSession(revokedMessage)} />);
    submitPassword();
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.activeTab).toBe("home");
    expect(result.current.bootstrapError).toBe(revokedMessage);
    expect(setModules).toHaveBeenLastCalledWith([]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // No redundant cookie-changing logout.
    await apiClient.createRecipe({ title: "QA" });
    expect(fetchMock.mock.calls[2][1]?.headers).not.toHaveProperty("X-CSRF-Token");
  });
});
