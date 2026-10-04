import { createContext, useContext, useMemo, useRef } from "react";
import type { PropsWithChildren, RefObject } from "react";

import type { FamilyModule } from "../api/models";

type ModuleAccess = {
  canManage: boolean;
  /** Live authority for callbacks retained by native confirmation dialogs. */
  canManageRef: RefObject<boolean>;
};

// Nonmodule actions (account/session UI) intentionally remain usable outside a
// provider. Module routes must always provide the current authoritative grant;
// null and legacy grants without can_manage fail closed inside that boundary.
const ModuleAccessContext = createContext<ModuleAccess>({
  canManage: true,
  canManageRef: { current: true },
});

export function ModuleAccessProvider({
  children,
  module,
}: PropsWithChildren<{ module: FamilyModule | null }>) {
  const canManage = module?.can_manage === true;
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  const value = useMemo(() => ({ canManage, canManageRef }), [canManage]);
  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useModuleAccess(): ModuleAccess {
  return useContext(ModuleAccessContext);
}
