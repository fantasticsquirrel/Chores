import { useCallback, useState } from "react";

import { apiClient } from "../api/client";
import type { FamilyModule } from "../api/models";

export function useModules() {
  const [modules, setModules] = useState<FamilyModule[]>([]);

  const loadModules = useCallback(async (): Promise<FamilyModule[]> => {
    const response = await apiClient.getMyModules();
    setModules(response.modules);
    return response.modules;
  }, []);

  return { loadModules, modules, setModules };
}
