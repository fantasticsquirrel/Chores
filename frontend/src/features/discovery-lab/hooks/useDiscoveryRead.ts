import { useCallback, useEffect, useRef, useState } from "react";
import { formatApiError } from "../../../lib/errors";

type ReadState<T> = {
  key: string;
  data: T | null;
  error: string | null;
  loading: boolean;
};

/** Retire data immediately when identity/route changes and ignore late responses. */
export function useDiscoveryRead<T>(
  key: string,
  read: () => Promise<T>,
  enabled = true,
  retainWhileRefreshing = false,
) {
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ReadState<T>>({
    key: "",
    data: null,
    error: null,
    loading: true,
  });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    const requestGeneration = ++generation.current;
    if (!enabled) return;
    setState((previous) => ({
      key,
      data:
        retainWhileRefreshing && previous.key === key ? previous.data : null,
      error: null,
      loading: true,
    }));
    read().then(
      (data) => {
        if (current && requestGeneration === generation.current)
          setState({ key, data, error: null, loading: false });
      },
      (error: unknown) => {
        if (current && requestGeneration === generation.current)
          setState({
            key,
            data: null,
            error: formatApiError(error),
            loading: false,
          });
      },
    );
    return () => {
      current = false;
    };
  }, [key, read, enabled, revision, retainWhileRefreshing]);
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);
  const replace = useCallback(
    (data: T) => {
      generation.current++;
      setState({ key, data, error: null, loading: false });
    },
    [key],
  );
  return {
    replace,
    ...(enabled && state.key === key
      ? state
      : { data: null, error: null, loading: enabled }),
    refresh,
  };
}
