import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import type { FamilyModule } from "../api/models";
import { ModuleAccessProvider, useModuleAccess } from "./ModuleAccessContext";

const module: FamilyModule = { key: "chores", name: "Chores", description: "Chores" };

describe("ModuleAccessProvider", () => {
  it.each([null, module, { ...module, can_manage: false }])(
    "fails closed for a missing or non-manage grant: %p", (grant) => {
      const { result } = renderHook(useModuleAccess, {
        wrapper: ({ children }: PropsWithChildren) => (
          <ModuleAccessProvider module={grant}>{children}</ModuleAccessProvider>
        ),
      });
      expect(result.current.canManage).toBe(false);
      expect(result.current.canManageRef.current).toBe(false);
    },
  );

  it("updates the live authority seen by retained callbacks on revocation", () => {
    let grant: FamilyModule = { ...module, can_manage: true };
    const { result, rerender } = renderHook(useModuleAccess, {
      wrapper: ({ children }: PropsWithChildren) => (
        <ModuleAccessProvider module={grant}>{children}</ModuleAccessProvider>
      ),
    });
    const access = result.current;
    expect(access.canManage).toBe(true);
    grant = { ...module, can_manage: false };
    rerender({});
    const mutate = jest.fn();
    act(() => { if (access.canManageRef.current) mutate(); });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("deliberately allows nonmodule actions outside a provider", () => {
    const { result } = renderHook(useModuleAccess);
    expect(result.current.canManage).toBe(true);
    expect(result.current.canManageRef.current).toBe(true);
  });
});
