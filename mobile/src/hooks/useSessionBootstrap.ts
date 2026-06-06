import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../api/client";
import type { AuthSessionResponse, FamilyModule } from "../api/models";
import { defaultTabForRole } from "../navigation/tabs";
import type { AppTab } from "../navigation/types";
import { formatError, isUnauthorized } from "../utils/format";

export function useSessionBootstrap({
  loadModules,
  setModules,
}: {
  loadModules: () => Promise<FamilyModule[]>;
  setModules: (modules: FamilyModule[]) => void;
}) {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const currentSession = await apiClient.getCurrentSession();
        if (cancelled) {
          return;
        }
        setSession(currentSession);
        setActiveTab(defaultTabForRole(currentSession.user.role));

        try {
          await loadModules();
        } catch (error) {
          if (!cancelled) {
            setBootstrapError(
              `Signed in, but modules could not load: ${formatError(error)}`,
            );
          }
        }
      } catch (error) {
        if (!cancelled && !isUnauthorized(error)) {
          setBootstrapError(formatError(error));
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [loadModules]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const nextSession = await apiClient.login({
        email: email.trim(),
        password,
      });
      setSession(nextSession);
      setActiveTab(defaultTabForRole(nextSession.user.role));
      setBootstrapError(null);
      try {
        await loadModules();
      } catch (error) {
        setBootstrapError(
          `Signed in, but modules could not load: ${formatError(error)}`,
        );
      }
    },
    [loadModules],
  );

  const handleLogout = useCallback(async () => {
    await apiClient.logout();
    setSession(null);
    setModules([]);
    setActiveTab("home");
  }, [setModules]);

  return {
    activeTab,
    bootstrapping,
    bootstrapError,
    handleLogin,
    handleLogout,
    session,
    setActiveTab,
    setBootstrapError,
  };
}
