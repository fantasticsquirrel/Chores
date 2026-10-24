import { useCallback, useEffect, useState } from "react";
import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import {
  clearPackageContentCache,
  loadAuthorizedPackage,
  withAuthorizationDeadline,
} from "./packageCache";
import { useDiscoveryRead } from "../hooks/useDiscoveryRead";
import { WorkerRuntime } from "./WorkerRuntime";
import { RelationshipRuntime } from "./RelationshipRuntime";
export function PackagePreview({
  payload,
}: {
  payload: DiscoveryPackagePayload;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, []);
  if (!online)
    return <p role="alert">Reconnect before running this package.</p>;
  if (
    !["declarative-v1", "worker-v1", "worker-3d-v1", "worker-rich-v1"].includes(
      payload.manifest.runtime,
    )
  )
    return (
      <p role="alert">
        This package requires a newer application. Its runtime is not supported
        here.
      </p>
    );
  return payload.manifest.runtime === "worker-v1" ||
    payload.manifest.runtime === "worker-3d-v1" ||
    String(payload.manifest.runtime) === "worker-rich-v1" ? (
    <WorkerRuntime key={payload.checksum} payload={payload} />
  ) : (
    <RelationshipRuntime key={payload.checksum} payload={payload} />
  );
}
/** Authorization is never cached offline. Recheck every 15 seconds and on focus. */
export function AuthorizedPackage({
  id,
  identity,
  expectedChecksum,
}: {
  id: string;
  identity: string;
  expectedChecksum?: string;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => () => clearPackageContentCache(), [identity, id]);
  const read = useCallback(
    () => withAuthorizationDeadline(loadAuthorizedPackage(id, identity)),
    [id, identity],
  );
  const state = useDiscoveryRead(`${identity}:${id}`, read, online, true);
  useEffect(() => {
    const off = () => setOnline(false);
    const on = () => setOnline(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    const timer = setInterval(state.refresh, 15000);
    return () => clearInterval(timer);
  }, [online, state.refresh]);
  if (!online)
    return (
      <p role="alert">
        Reconnect to verify access before running this package.
      </p>
    );
  if (state.error)
    return (
      <p role="alert">This package is no longer available: {state.error}</p>
    );
  if (!state.data) return <p>Verifying package access…</p>;
  if (expectedChecksum && state.data.checksum !== expectedChecksum)
    return (
      <p role="alert">
        The published version changed. Reopen this Exploration to load its
        matching lesson and simulation.
      </p>
    );
  return <PackagePreview payload={state.data} />;
}
