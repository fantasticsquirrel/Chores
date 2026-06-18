import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient, type AuthSessionResponse, type AuthUser } from "../api";
import { isUnauthorizedError } from "../lib/errors";
import { familyModules } from "../modules/registry";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./context";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    void apiClient
      .getCurrentSession()
      .then(async (session) => {
        const loadedModuleKeys = await loadModuleKeys(session.user);
        if (!active) {
          return;
        }

        setUser(session.user);
        setModuleKeys(loadedModuleKeys);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (isUnauthorizedError(error)) {
          setUser(null);
          setModuleKeys([]);
          setStatus("anonymous");
          return;
        }

        setUser(null);
        setModuleKeys([]);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const setAuthenticatedSession = useCallback((session: AuthSessionResponse): void => {
    setUser(session.user);
    setModuleKeys(getFallbackModuleKeys(session.user));
    setStatus("authenticated");

    void loadModuleKeys(session.user).then(setModuleKeys);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiClient.logout();
    setUser(null);
    setModuleKeys([]);
    setStatus("anonymous");
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      moduleKeys,
      setAuthenticatedSession,
      logout,
    }),
    [logout, moduleKeys, setAuthenticatedSession, status, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}


function getFallbackModuleKeys(user: AuthUser): string[] {
  return familyModules
    .filter((module) => module.roles.includes(user.role))
    .map((module) => module.key);
}

async function loadModuleKeys(user: AuthUser): Promise<string[]> {
  try {
    const response = await apiClient.getMyModules();
    return response.modules.map((module) => module.key);
  } catch {
    return getFallbackModuleKeys(user);
  }
}
