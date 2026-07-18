import { createContext, useContext } from "react";

import type { OpsSessionResponse } from "@family-manager/family-api/ops-models";

export type OpsAuthValue = {
  status: "loading" | "anonymous" | "authenticated";
  session: OpsSessionResponse | null;
  setSession: (value: OpsSessionResponse | null) => void;
};

export const OpsAuthContext = createContext<OpsAuthValue | null>(null);

export function useOpsAuth(): OpsAuthValue {
  const value = useContext(OpsAuthContext);
  if (value === null) {
    throw new Error("useOpsAuth must be used within OpsAuthProvider");
  }
  return value;
}
