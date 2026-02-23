import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiClientError, apiClient, type AuthSessionResponse, type AuthUser } from "../api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./context";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    void apiClient
      .getCurrentSession()
      .then((session) => {
        if (!active) {
          return;
        }

        setUser(session.user);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          setUser(null);
          setStatus("anonymous");
          return;
        }

        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const setAuthenticatedSession = useCallback((session: AuthSessionResponse): void => {
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      setAuthenticatedSession,
      logout,
    }),
    [logout, setAuthenticatedSession, status, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
