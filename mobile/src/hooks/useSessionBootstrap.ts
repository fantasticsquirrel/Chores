import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "../api/client";
import type { AuthSessionResponse, FamilyModule } from "../api/models";
import { defaultTabForRole } from "../navigation/tabs";
import type { AppTab } from "../navigation/types";
import { formatError, isUnauthorized } from "../utils/format";

export type ParentLoginInput = { email: string; password: string };
export type ChildLoginInput = { parentEmail: string; childName: string; password: string };

export function useSessionBootstrap({ loadModules, setModules }: {
  loadModules: () => Promise<FamilyModule[]>;
  setModules: (modules: FamilyModule[]) => void;
}) {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const request = generation.current;
    const current = () => !cancelled && request === generation.current;
    async function bootstrapSession() {
      try {
        const currentSession = await apiClient.getCurrentSession();
        if (!current()) return;
        setSession(currentSession);
        setActiveTab(defaultTabForRole(currentSession.user.role));
        try {
          await loadModules();
        } catch (error) {
          if (current()) setBootstrapError(`Signed in, but modules could not load: ${formatError(error)}`);
        }
      } catch (error) {
        if (current() && !isUnauthorized(error)) setBootstrapError(formatError(error));
      } finally {
        if (current()) setBootstrapping(false);
      }
    }
    void bootstrapSession();
    return () => { cancelled = true; };
  }, [loadModules]);

  const applyAuthenticatedSession = useCallback(
    async (nextSession: AuthSessionResponse, request: number) => {
      if (request !== generation.current) return;
      setModules([]);
      setSession(nextSession);
      setActiveTab(defaultTabForRole(nextSession.user.role));
      setBootstrapError(null);
      setBootstrapping(false);
      try {
        await loadModules();
      } catch (error) {
        if (request === generation.current) {
          setBootstrapError(`Signed in, but modules could not load: ${formatError(error)}`);
        }
      }
    }, [loadModules, setModules],
  );

  const handleParentLogin = useCallback(async ({ email, password }: ParentLoginInput) => {
    const request = ++generation.current;
    const nextSession = await apiClient.login({ email: email.trim(), password });
    await applyAuthenticatedSession(nextSession, request);
  }, [applyAuthenticatedSession]);

  const handleChildLogin = useCallback(async ({ parentEmail, childName, password }: ChildLoginInput) => {
    const request = ++generation.current;
    const nextSession = await apiClient.childLogin({ parent_email: parentEmail.trim(), child_name: childName.trim(), password });
    await applyAuthenticatedSession(nextSession, request);
  }, [applyAuthenticatedSession]);

  const clearSession = useCallback((message: string | null = null) => {
    generation.current += 1;
    apiClient.clearAuthentication();
    setSession(null);
    setModules([]);
    setActiveTab("home");
    setBootstrapError(message);
    setBootstrapping(false);
  }, [setModules]);

  const handleLogout = useCallback(async () => {
    const request = ++generation.current;
    try {
      await apiClient.logout();
    } finally {
      if (request === generation.current) clearSession();
    }
  }, [clearSession]);

  return { activeTab, bootstrapping, bootstrapError, clearSession, handleChildLogin, handleLogout,
    handleParentLogin, session, setActiveTab, setBootstrapError };
}
