import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClient, type AuthSessionResponse, type AuthUser } from "../api";
import { familyModules } from "../modules/registry";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./context";

const FAMILY_TREE_KEY = "family-tree";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [manageableModuleKeys, setManageableModuleKeys] = useState<string[]>(
    [],
  );
  // Every session replacement/clear invalidates all work owned by its predecessor.
  // Within a session, only the newest discovery may publish access (or denial).
  const generations = useRef({ session: 0, discovery: 0 });
  const currentUser = useRef<AuthUser | null>(null);

  useEffect(() => {
    const ownership = generations.current;
    const owner = ownership.session;

    void apiClient
      .getCurrentSession()
      .then(async (session) => {
        if (owner !== generations.current.session) {
          return;
        }
        const discovery = ++generations.current.discovery;
        const loadedModules = await loadModuleAccess(session.user);
        if (
          owner !== generations.current.session ||
          discovery !== generations.current.discovery
        ) {
          return;
        }

        currentUser.current = session.user;
        setUser(session.user);
        setModuleKeys(loadedModules.moduleKeys);
        setManageableModuleKeys(loadedModules.manageableModuleKeys);
        setStatus("authenticated");
      })
      .catch(() => {
        if (owner !== generations.current.session) {
          return;
        }

        currentUser.current = null;
        setUser(null);
        setModuleKeys([]);
        setManageableModuleKeys([]);
        setStatus("anonymous");
      });

    return () => {
      ++ownership.session;
      ++ownership.discovery;
    };
  }, []);

  const setAuthenticatedSession = useCallback(
    (session: AuthSessionResponse): void => {
      const owner = ++generations.current.session;
      const discovery = ++generations.current.discovery;
      const fallback = getFallbackModuleKeys(session.user);
      currentUser.current = session.user;
      setUser(session.user);
      setModuleKeys(fallback);
      setManageableModuleKeys(fallback);
      setStatus("authenticated");

      void loadModuleAccess(session.user).then((loaded) => {
        if (
          owner !== generations.current.session ||
          discovery !== generations.current.discovery
        ) {
          return;
        }
        setModuleKeys(loaded.moduleKeys);
        setManageableModuleKeys(loaded.manageableModuleKeys);
      });
    },
    [],
  );

  const clearSession = useCallback((): void => {
    ++generations.current.session;
    ++generations.current.discovery;
    currentUser.current = null;
    setUser(null);
    setModuleKeys([]);
    setManageableModuleKeys([]);
    setStatus("anonymous");
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Invalidate pending work immediately, not only when logout completes.
    const owner = ++generations.current.session;
    ++generations.current.discovery;
    await apiClient.logout();
    if (owner === generations.current.session) {
      clearSession();
    }
  }, [clearSession]);

  const refreshModuleAccess = useCallback(async (): Promise<void> => {
    if (user === null || currentUser.current !== user) {
      return;
    }
    const owner = generations.current.session;
    const discovery = ++generations.current.discovery;
    const ownsDiscovery = () =>
      owner === generations.current.session &&
      discovery === generations.current.discovery;
    try {
      const response = await apiClient.getMyModules();
      if (!ownsDiscovery()) {
        return;
      }
      const loaded = getDiscoveredModuleAccess(user, response);
      setModuleKeys(loaded.moduleKeys);
      setManageableModuleKeys(loaded.manageableModuleKeys);
    } catch (error: unknown) {
      if (ownsDiscovery()) {
        // Preserve legacy modules, but never present failed genealogy discovery
        // as authoritative. Keep rejection observable so callers can show retry.
        setModuleKeys((keys) => keys.filter((key) => key !== FAMILY_TREE_KEY));
        setManageableModuleKeys((keys) =>
          keys.filter((key) => key !== FAMILY_TREE_KEY),
        );
      }
      throw error;
    }
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
    [
      clearSession,
      logout,
      manageableModuleKeys,
      moduleKeys,
      refreshModuleAccess,
      setAuthenticatedSession,
      status,
      user,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

function getFallbackModuleKeys(user: AuthUser): string[] {
  return familyModules
    .filter(
      (module) =>
        module.key !== FAMILY_TREE_KEY && module.roles.includes(user.role),
    )
    .map((module) => module.key);
}

type ModuleAccess = {
  moduleKeys: string[];
  manageableModuleKeys: string[];
};

type ModulesResponse = Awaited<ReturnType<typeof apiClient.getMyModules>>;

function getDiscoveredModuleAccess(
  user: AuthUser,
  response: ModulesResponse,
): ModuleAccess {
  const modules = response.modules.filter(
    (module) =>
      module.key !== FAMILY_TREE_KEY ||
      user.role === "PARENT" ||
      user.role === "PARENT_ADMIN",
  );
  return {
    moduleKeys: modules.map((module) => module.key),
    manageableModuleKeys: modules
      .filter((module) =>
        module.key === FAMILY_TREE_KEY
          ? module.can_manage === true
          : module.can_manage !== false,
      )
      .map((module) => module.key),
  };
}

async function loadModuleAccess(user: AuthUser): Promise<ModuleAccess> {
  try {
    const response = await apiClient.getMyModules();
    return getDiscoveredModuleAccess(user, response);
  } catch {
    const fallback = getFallbackModuleKeys(user);
    return { moduleKeys: fallback, manageableModuleKeys: fallback };
  }
}
