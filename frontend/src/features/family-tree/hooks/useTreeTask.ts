import { useEffect, useRef, useState } from "react";
import type { RequestOptions } from "@family-manager/family-api/client-core";
import { ApiClientError } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { cancellable } from "../lib/workflows/workflows";
import { useTreeRuntime } from "./useTreeCommand";

/** Session-owned staging/preview/read requests, never a mutation retry queue. */
export function useTreeTask(requireManage = true) {
  const runtime = useTreeRuntime();
  const current = useRef(runtime);
  current.current = runtime;
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const ownsBusy = useRef(false);
  const release = runtime.setBusy;
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      if (ownsBusy.current) {
        ownsBusy.current = false;
        release(false);
      }
    };
  }, [release]);
  useEffect(() => {
    if (
      runtime.checking ||
      !runtime.online ||
      (requireManage && !runtime.manage)
    )
      controller.current?.abort();
  }, [runtime.checking, runtime.online, runtime.manage, requireManage]);
  async function run<T>(
    operation: (options: RequestOptions) => Promise<T>,
  ): Promise<T | null> {
    const owner = current.current.owner;
    if (
      !alive.current ||
      controller.current ||
      !current.current.online ||
      current.current.checking ||
      current.current.isBusy() ||
      (requireManage && !current.current.manage)
    )
      return null;
    const request = new AbortController();
    controller.current = request;
    ownsBusy.current = true;
    release(true);
    setPending(true);
    setError(null);
    setCode(null);
    try {
      const result = await cancellable(
        operation({ signal: request.signal }),
        request.signal,
      );
      if (
        !alive.current ||
        request.signal.aborted ||
        current.current.owner !== owner ||
        current.current.checking ||
        !current.current.online ||
        (requireManage && !current.current.manage)
      )
        return null;
      return result;
    } catch (failure) {
      if (!alive.current) return null;
      if (
        failure instanceof ApiClientError &&
        [401, 403].includes(failure.status)
      ) {
        current.current.revoke();
        return null;
      }
      setCode(
        failure instanceof ApiClientError ? (failure.code ?? null) : null,
      );
      let message = formatApiError(failure);
      if (
        failure instanceof ApiClientError &&
        failure.code === "merge_aliases_present"
      ) {
        const data = failure.data as
          | { detail?: { blocking_alias_ids?: unknown } }
          | undefined;
        const ids = data?.detail?.blocking_alias_ids;
        if (
          Array.isArray(ids) &&
          ids.every((id) => Number.isSafeInteger(id) && id > 0)
        )
          message += ` Blocking alias person IDs: ${ids.join(", ")}. Open and explicitly purge each alias, then request a fresh target preview.`;
      }
      setError(
        request.signal.aborted
          ? "Request interrupted; your draft is retained. Recheck access and retry explicitly."
          : message,
      );
      return null;
    } finally {
      controller.current = null;
      if (alive.current) {
        setPending(false);
        if (ownsBusy.current) {
          ownsBusy.current = false;
          release(false);
        }
      }
    }
  }
  return { run, pending, error, code, setError };
}
