import { useCallback, useEffect, useState } from "react";
import { formatApiError } from "../lib/errors";

/** Owns a single read scope; late responses from a previous scope are ignored. */
export function useOpsRead<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setPending(true);
    setData(null);
    setError(null);
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    setPending(true);
    setData(null);
    setError(null);
    void load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((failure: unknown) => {
        if (active) setError(formatApiError(failure));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [load, revision]);
  return { data, error, pending, retry };
}
