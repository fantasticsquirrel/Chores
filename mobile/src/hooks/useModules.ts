import { useCallback, useRef, useState } from "react";

import { apiClient } from "../api/client";
import type { FamilyModule } from "../api/models";

export function useModules() {
  const [modules, setModulesState] = useState<FamilyModule[]>([]);
  const generation = useRef(0);

  const setModules = useCallback((next: FamilyModule[]) => {
    generation.current += 1;
    setModulesState(next);
  }, []);

  const loadModules = useCallback(async (): Promise<FamilyModule[]> => {
    const request = ++generation.current;
    const response = await apiClient.getMyModules();
    if (request !== generation.current) return [];
    setModulesState(response.modules);
    return response.modules;
  }, []);

  return { loadModules, modules, setModules };
}
