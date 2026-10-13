import {
  createContext,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
const DraftContext = createContext<Map<string, unknown> | null>(null);
/** Form drafts only, scoped to one mounted adult screen/session; never persisted. */
export function DraftMemory({ children }: { children: ReactNode }) {
  const memory = useRef(new Map<string, unknown>());
  return (
    <DraftContext.Provider value={memory.current}>
      {children}
    </DraftContext.Provider>
  );
}
export function useDraftMemory() {
  const memory = useContext(DraftContext);
  return { clear: () => memory?.clear() };
}
export function useDraftState<T>(
  key: string,
  initial: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(DraftContext);
  const [value, setValue] = useState<T>(() => {
    if (memory?.has(key)) return memory.get(key) as T;
    const value = initial();
    memory?.set(key, value);
    return value;
  });
  const update: Dispatch<SetStateAction<T>> = (next) =>
    setValue((previous) => {
      const value =
        typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      memory?.set(key, value);
      return value;
    });
  return [value, update];
}
