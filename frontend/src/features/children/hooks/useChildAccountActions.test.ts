import { act, renderHook } from "@testing-library/react";

import { apiClient, type Child } from "../../../api";
import { useChildAccountActions } from "./useChildAccountActions";

const children: Child[] = [
  { id: 11, household_id: 7, name: "Riley", active: true },
];

describe("useChildAccountActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes the optional email and preserves the child-account payload", async () => {
    const createChildAccount = vi
      .spyOn(apiClient, "createChildAccount")
      .mockResolvedValue({
        id: 31,
        household_id: 7,
        email: "kid@example.com",
        role: "CHILD",
        child_id: 11,
      });
    const { result } = renderHook(() =>
      useChildAccountActions({
        children,
        householdId: 7,
        selectedChildId: 11,
      }),
    );

    act(() => {
      result.current.linkAccount.setEmail("  KID@EXAMPLE.COM  ");
      result.current.linkAccount.setPassword("child-password");
    });
    await act(async () => result.current.linkAccount.submit());

    expect(createChildAccount).toHaveBeenCalledWith(11, {
      household_id: 7,
      email: "kid@example.com",
      password: "child-password",
    });
    expect(result.current.linkAccount.success).toBe(
      "Linked login created for Riley. Child can sign in with a parent login email, Riley, and the child password. Legacy email kid@example.com still works for email/password sign-in.",
    );
    expect(result.current.linkAccount.email).toBe("");
    expect(result.current.linkAccount.password).toBe("");
  });

  it("maps a blank reset email to the existing null payload", async () => {
    const resetChildAccountEmail = vi
      .spyOn(apiClient, "resetChildAccountEmail")
      .mockResolvedValue({
        id: 31,
        household_id: 7,
        email: "generated@example.invalid",
        role: "CHILD",
        child_id: 11,
      });
    const { result } = renderHook(() =>
      useChildAccountActions({
        children,
        householdId: 7,
        selectedChildId: 11,
      }),
    );

    act(() => result.current.resetEmail.setEmail("   "));
    await act(async () => result.current.resetEmail.submit());

    expect(resetChildAccountEmail).toHaveBeenCalledWith(11, {
      household_id: 7,
      email: null,
    });
    expect(result.current.resetEmail.success).toContain(
      "generated@example.invalid still works",
    );
  });

  it("validates matching reset passwords before calling the API", async () => {
    const resetChildAccountPassword = vi.spyOn(
      apiClient,
      "resetChildAccountPassword",
    );
    const { result } = renderHook(() =>
      useChildAccountActions({
        children,
        householdId: 7,
        selectedChildId: 11,
      }),
    );

    act(() => {
      result.current.resetPassword.setPassword("new-password");
      result.current.resetPassword.setConfirmation("different-password");
    });
    await act(async () => result.current.resetPassword.submit());

    expect(result.current.resetPassword.error).toBe(
      "Temporary password and confirmation must match.",
    );
    expect(resetChildAccountPassword).not.toHaveBeenCalled();
  });
});
