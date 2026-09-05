import { useCallback, useEffect, useState } from "react";

import { apiClient, type HouseholdModuleAccess } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import type { FamilyModuleKey } from "../../../modules/registry";

type UseHouseholdModulesOptions = {
  refreshModuleAccess: () => Promise<void>;
  refreshUsers: () => void;
};

export type UseHouseholdModulesResult = {
  actionError: string | null;
  actionMessage: string | null;
  error: string | null;
  loadModules: () => void;
  loading: boolean;
  modules: HouseholdModuleAccess[];
  pendingKey: FamilyModuleKey | null;
  toggleModule: (module: HouseholdModuleAccess) => Promise<void>;
};

export function useHouseholdModules({
  refreshModuleAccess,
  refreshUsers,
}: UseHouseholdModulesOptions): UseHouseholdModulesResult {
  const [modules, setModules] = useState<HouseholdModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<FamilyModuleKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadModules = useCallback((): void => {
    setLoading(true);
    setError(null);
    apiClient
      .listHouseholdModules()
      .then((rows) => {
        setModules(rows);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        setModules([]);
        setLoading(false);
        setError(formatApiError(loadError));
      });
  }, []);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  async function toggleModule(module: HouseholdModuleAccess): Promise<void> {
    if (module.key === "admin" || !module.can_disable) {
      return;
    }

    setPendingKey(module.key);
    setActionError(null);
    setActionMessage(`Updating ${module.name} for the whole household…`);
    try {
      const updated = await apiClient.setHouseholdModuleAccess(module.key, {
        enabled: !module.enabled,
      });
      setModules((previous) =>
        previous.map((row) => (row.key === updated.key ? updated : row)),
      );
      refreshUsers();
      try {
        await refreshModuleAccess();
      } catch (refreshError: unknown) {
        setActionMessage(null);
        setActionError(
          `The household setting was saved, but navigation could not refresh: ${formatApiError(refreshError)}`,
        );
        return;
      }
      setActionMessage(
        `${updated.name} is now ${updated.enabled ? "enabled" : "disabled"} for the whole household.`,
      );
    } catch (updateError: unknown) {
      setActionMessage(null);
      setActionError(formatApiError(updateError));
    } finally {
      setPendingKey(null);
    }
  }

  return {
    actionError,
    actionMessage,
    error,
    loadModules,
    loading,
    modules,
    pendingKey,
    toggleModule,
  };
}
