import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  normalizeBirthBandColor,
  type BirthBandColors,
} from "@family-manager/family-tree-core";

export function useLocalColors() {
  const [custom, setCustom] = useState<BirthBandColors>({});
  const [resetVersion, setResetVersion] = useState(0);
  const apply = useCallback((key: string, value: string) => {
    const color = normalizeBirthBandColor(value);
    // Only date-domain keys, at most 400 bands plus unknown.
    if (!color || !/^(unknown|years:(1|[1-9]\d{0,3}))$/.test(key)) return false;
    const year = Number(key.slice(6));
    if (
      key !== "unknown" &&
      year !== 1 &&
      (year > 9975 || year % 25 !== 0)
    )
      return false;
    setCustom((current) => ({ ...current, [key]: color }));
    return true;
  }, []);
  const reset = useCallback(() => {
    setCustom({});
    setResetVersion((current) => current + 1);
  }, []);
  return useMemo(
    () => ({ custom, resetVersion, apply, reset }),
    [custom, resetVersion, apply, reset],
  );
}
export const ColorContext = createContext<ReturnType<typeof useLocalColors> | null>(null);

export function useBirthBandColors() {
  const scope = useContext(ColorContext);
  if (!scope) throw new Error("Birth-band colors require a presentation scope");
  return scope;
}
