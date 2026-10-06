import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import { ChangePasswordScreen } from "./ChangePasswordScreen";

const initial = {
  csrf_token: "initial-csrf",
  user: { id: 1, email: "parent@example.test", role: "PARENT" as const, household_id: 1, child_id: null },
};
function authResponse(session = initial) {
  return {
    ok: true, status: 200,
    headers: { get: () => "application/json" },
    json: async () => session,
  } as unknown as Response;
}
function pendingChange() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
  jest.spyOn(apiClient, "changePassword").mockReturnValue(promise);
  return { promise, resolve, reject };
}
function submitPassword() {
  fireEvent.changeText(screen.getByPlaceholderText("Current password"), "current-test-password");
  fireEvent.changeText(screen.getByPlaceholderText("At least 15 characters"), "new-test-password-long");
  fireEvent.changeText(screen.getByPlaceholderText("Repeat new password"), "new-test-password-long");
  fireEvent.press(screen.getByText("Update Password"));
}

beforeEach(async () => {
  apiClient.clearAuthentication();
  // Mock only the transport so real auth operations still establish ownership.
  jest.spyOn(apiClient as unknown as { fetchImpl: typeof fetch }, "fetchImpl")
    .mockResolvedValue(authResponse());
  await apiClient.login({ email: initial.user.email, password: "fixture-password" });
});
afterEach(() => { jest.restoreAllMocks(); apiClient.clearAuthentication(); });

describe("password change session boundary", () => {
  it("clears fields and exits the matching revoked session after success", async () => {
    jest.spyOn(apiClient, "changePassword").mockResolvedValue(undefined);
    const cleared = jest.fn();
    render(<ChangePasswordScreen onPasswordChanged={cleared} />);
    submitPassword();
    await screen.findByText("Password changed. Sign in again.");
    expect(cleared).toHaveBeenCalledTimes(1);
    for (const placeholder of ["Current password", "At least 15 characters", "Repeat new password"]) {
      expect(screen.getByPlaceholderText(placeholder).props.value).toBe("");
    }
  });

  it("tears down the matching revoked session even after the password screen unmounts", async () => {
    const pending = pendingChange();
    const cleared = jest.fn();
    const view = render(<ChangePasswordScreen onPasswordChanged={cleared} />);
    submitPassword();
    view.unmount();
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it("does not tear down a replacement session after the old password screen unmounts", async () => {
    const pending = pendingChange();
    const cleared = jest.fn();
    const view = render(<ChangePasswordScreen onPasswordChanged={cleared} />);
    submitPassword();
    view.unmount();
    await act(async () => { await apiClient.login({ email: "next@example.test", password: "fixture-password" }); });
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(cleared).not.toHaveBeenCalled();
  });

  it.each([false, true])("does not clear a replacement session even when the actor ID is unchanged=%s", async (sameActor) => {
    const pending = pendingChange();
    const oldCleared = jest.fn();
    const newCleared = jest.fn();
    const view = render(<ChangePasswordScreen onPasswordChanged={oldCleared} />);
    submitPassword();
    jest.mocked((apiClient as unknown as { fetchImpl: typeof fetch }).fetchImpl)
      .mockResolvedValue(authResponse({ ...initial, csrf_token: "new-csrf", user: { ...initial.user, id: sameActor ? 1 : 2 } }));
    await act(async () => { await apiClient.login({ email: "next@example.test", password: "fixture-password" }); });
    view.rerender(<ChangePasswordScreen onPasswordChanged={newCleared} />);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(oldCleared).not.toHaveBeenCalled();
    expect(newCleared).not.toHaveBeenCalled();
    expect(screen.queryByText("Password changed. Sign in again.")).toBeNull();
    // An actor/session change must also discard the old form and its busy state.
    expect(screen.getByPlaceholderText("Current password").props.value).toBe("");
    expect(screen.getByText("Update Password")).toBeTruthy();
  });

  it("ignores an old actor's password-change error", async () => {
    const pending = pendingChange();
    const cleared = jest.fn();
    const view = render(<ChangePasswordScreen onPasswordChanged={cleared} />);
    submitPassword();
    await act(async () => { await apiClient.childLogin({ parent_email: "parent@example.test", child_name: "Maya", password: "fixture-password" }); });
    view.rerender(<ChangePasswordScreen onPasswordChanged={cleared} />);
    await act(async () => { pending.reject(new Error("old actor error")); await pending.promise.catch(() => undefined); });
    expect(screen.queryByText("Could not change password: old actor error")).toBeNull();
    expect(cleared).not.toHaveBeenCalled();
  });

  it("keeps the matching session and reports a failed password change", async () => {
    jest.spyOn(apiClient, "changePassword").mockRejectedValue(new Error("Current password is incorrect."));
    const cleared = jest.fn();
    render(<ChangePasswordScreen onPasswordChanged={cleared} />);
    submitPassword();
    await screen.findByText("Could not change password: Current password is incorrect.");
    expect(cleared).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Current password").props.value).toBe("current-test-password");
    expect(screen.getByText("Update Password")).toBeTruthy();
  });
});
