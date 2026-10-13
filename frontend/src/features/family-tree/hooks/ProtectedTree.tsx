import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TreeRuntimeContext } from "./useTreeCommand";
export function ProtectedTree({
  owner,
  manage,
  checking,
  revoke,
  children,
}: {
  owner: string;
  manage: boolean;
  checking: boolean;
  revoke: () => void;
  children: ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
          mutations: { retry: false },
        },
      }),
  );
  const [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    floor = useRef(0),
    busyRef = useRef(false);
  const setProtectedBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      void client.cancelQueries();
      client.clear();
    };
  }, [client]);
  useEffect(() => {
    if (checking) void client.cancelQueries();
  }, [checking, client]);
  const runtime = useMemo(
    () => ({
      owner,
      manage,
      checking,
      online,
      busy,
      setBusy: setProtectedBusy,
      floor,
      revision: () => floor.current,
      revoke,
      isBusy: () => busyRef.current || checking,
    }),
    [owner, manage, checking, online, busy, setProtectedBusy, revoke],
  );
  return (
    <QueryClientProvider client={client}>
      <TreeRuntimeContext.Provider value={runtime}>
        {children}
      </TreeRuntimeContext.Provider>
    </QueryClientProvider>
  );
}
