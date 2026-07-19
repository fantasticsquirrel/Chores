import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import type { OpsSessionResponse } from "@family-manager/family-api/ops-models";
import { opsApi } from "../api/client";
import { OpsAuthContext, type OpsAuthValue } from "./OpsAuthState";

export function OpsAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [status, setStatus] = useState<OpsAuthValue["status"]>("loading");
  const [session, updateSession] = useState<OpsSessionResponse | null>(null);

  useEffect(() => {
    let active = true;
    void opsApi
      .getCurrentOpsSession()
      .then((value) => {
        if (active) {
          updateSession(value);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (active) setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      session,
      setSession: (next: OpsSessionResponse | null) => {
        updateSession(next);
        setStatus(next ? "authenticated" : "anonymous");
      },
    }),
    [session, status],
  );

  return (
    <OpsAuthContext.Provider value={value}>{children}</OpsAuthContext.Provider>
  );
}
