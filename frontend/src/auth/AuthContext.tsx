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
  const [manageableModuleKeys, setManageableModuleKeys] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    void apiClient
      .getCurrentSession()
      .then(async (session) => {
        const loadedModules = await loadModuleAccess(session.user);
        if (!active) {
          return;
        }

        setUser(session.user);
        setModuleKeys(loadedModules.moduleKeys);
        setManageableModuleKeys(loadedModules.manageableModuleKeys);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (isUnauthorizedError(error)) {
          setUser(null);
          setModuleKeys([]);
          setManageableModuleKeys([]);
          setStatus("anonymous");
          return;
        }

        setUser(null);
        setModuleKeys([]);
        setManageableModuleKeys([]);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const setAuthenticatedSession = useCallback((session: AuthSessionResponse): void => {
    const fallback = getFallbackModuleKeys(session.user);
    setUser(session.user);
    setModuleKeys(fallback);
    setManageableModuleKeys(fallback);
    setStatus("authenticated");

    void loadModuleAccess(session.user).then((loaded) => {
      setModuleKeys(loaded.moduleKeys);
      setManageableModuleKeys(loaded.manageableModuleKeys);
    });
  }, []);

  const clearSession = useCallback((): void => {
    setUser(null);
    setModuleKeys([]);
    setManageableModuleKeys([]);
    setStatus("anonymous");
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiClient.logout();
    clearSession();
  }, [clearSession]);

  const refreshModuleAccess = useCallback(async (): Promise<void> => {
    if (user === null) {
      return;
    }
    const response = await apiClient.getMyModules();
    setModuleKeys(response.modules.map((module) => module.key));
    setManageableModuleKeys(
      response.modules
        .filter((module) => module.can_manage !== false)
        .map((module) => module.key),
    );
  }, [user]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      moduleKeys,
      manageableModuleKeys,
      refreshModuleAccess,
      setAuthenticatedSession,
      clearSession,
      logout,
    }),
    [clearSession, logout, manageableModuleKeys, moduleKeys, refreshModuleAccess, setAuthenticatedSession, status, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}


function getFallbackModuleKeys(user: AuthUser): string[] {
  return familyModules
    .filter((module) => module.roles.includes(user.role))
    .map((module) => module.key);
}

type ModuleAccess = {
  moduleKeys: string[];
  manageableModuleKeys: string[];
};

async function loadModuleAccess(user: AuthUser): Promise<ModuleAccess> {
  try {
    const response = await apiClient.getMyModules();
    return {
      moduleKeys: response.modules.map((module) => module.key),
      manageableModuleKeys: response.modules.filter((module) => module.can_manage !== false).map((module) => module.key),
    };
  } catch {
    const fallback = getFallbackModuleKeys(user);
    return { moduleKeys: fallback, manageableModuleKeys: fallback };
  }
}
